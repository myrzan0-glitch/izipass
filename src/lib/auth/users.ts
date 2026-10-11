import { and, eq, gt, isNull, sql } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { loginTokens, users } from "@/lib/db/schema"
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

export async function issueLoginToken(db: Db, rawEmail: string, next: string | null) {
  const email = normalizeEmail(rawEmail)
  const { token, hash } = createLoginToken()
  await db.insert(loginTokens).values({ email, tokenHash: hash, next, expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS) })
  return { email, token }
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
