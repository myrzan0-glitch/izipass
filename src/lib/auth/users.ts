import { and, eq, gt, isNull, ne, sql } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { loginTokens, organizerMembers, users } from "@/lib/db/schema"
import { LOGIN_TOKEN_TTL_MS, createLoginToken, hashToken, normalizeEmail } from "@/lib/auth/tokens"
import { telegramDisplayName, type TelegramAuth } from "@/lib/auth/telegram"

/** Pure data access, so it can run against PGlite in tests. */

export async function upsertTelegramUser(db: Db, auth: TelegramAuth, locale: string) {
  const [existing] = await db.select().from(users).where(eq(users.telegramId, auth.id)).limit(1)
  const now = new Date()
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ telegramUsername: auth.username ?? null, lastLoginAt: now, name: existing.name || telegramDisplayName(auth) })
      .where(eq(users.id, existing.id))
      .returning()
    return updated
  }
  const [created] = await db
    .insert(users)
    .values({ telegramId: auth.id, telegramUsername: auth.username ?? null, name: telegramDisplayName(auth), locale, lastLoginAt: now })
    .returning()
  return created
}

/** `userId`: the signed-in person adding this email to their account. */
export async function issueLoginToken(db: Db, rawEmail: string, next: string | null, userId: string | null = null) {
  const email = normalizeEmail(rawEmail)
  const { token, hash } = createLoginToken()
  await db.insert(loginTokens).values({ email, tokenHash: hash, next, userId, expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS) })
  return { email, token }
}

export class AccountLinkError extends Error {
  constructor(public readonly code: "emailTaken" | "telegramTaken") {
    super(code)
  }
}

/** Marks the token used and returns the signed-in user, or null if invalid/expired/used. */
export async function consumeLoginToken(db: Db, token: string, locale: string) {
  const now = new Date()
  const [row] = await db
    .update(loginTokens)
    .set({ usedAt: now })
    .where(and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
    .returning()
  if (!row) return null

  // Adding an email to an account: the address must not belong to someone else.
  if (row.userId) {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${row.email}`, ne(users.id, row.userId)))
      .limit(1)
    if (owner) throw new AccountLinkError("emailTaken")
    const [user] = await db.update(users).set({ email: row.email, lastLoginAt: now }).where(eq(users.id, row.userId)).returning()
    return user ? { user, next: row.next } : null
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${row.email}`)
    .limit(1)
  const user = existing
    ? (await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, existing.id)).returning())[0]
    : (await db.insert(users).values({ email: row.email, locale, lastLoginAt: now }).returning())[0]
  return { user, next: row.next }
}

export async function getUser(db: Db, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}

/** Signed-in person connects their Telegram account. */
export async function linkTelegram(db: Db, userId: string, auth: TelegramAuth) {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.telegramId, auth.id), ne(users.id, userId)))
    .limit(1)
  if (owner) throw new AccountLinkError("telegramTaken")
  const [user] = await db
    .update(users)
    .set({ telegramId: auth.id, telegramUsername: auth.username ?? null })
    .where(eq(users.id, userId))
    .returning()
  return user ?? null
}

export type ProfileInput = { name: string; phone: string; locale: string }

export async function updateProfile(db: Db, userId: string, input: ProfileInput) {
  const [user] = await db.update(users).set(input).where(eq(users.id, userId)).returning()
  return user ?? null
}

/**
 * Deletes the account with its registrations. Not while the person owns an
 * organization: its events and guests would be left without anyone to run them.
 */
export async function deleteAccount(db: Db, userId: string) {
  const [owned] = await db
    .select({ id: organizerMembers.organizerId })
    .from(organizerMembers)
    .where(and(eq(organizerMembers.userId, userId), eq(organizerMembers.role, "owner")))
    .limit(1)
  if (owned) return false
  await db.delete(users).where(eq(users.id, userId))
  return true
}
