import { randomInt } from "node:crypto"
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { isUuid } from "@/lib/ids"
import { events, organizers, receipts, registrations, type Event, type Registration, type RegistrationStatus } from "@/lib/db/schema"

/** Statuses that take a spot. */
export const ACTIVE: RegistrationStatus[] = ["held", "proof_sent", "confirmed"]

export class RegistrationError extends Error {
  constructor(public readonly code: "closed" | "already" | "notFound" | "badState") {
    super(code)
  }
}

export type RegisterInput = { name: string; phone: string; note: string }

/** ESC-4821: letters from the organizer slug plus 4 digits, unique per event. */
export function referenceCode(organizerSlug: string) {
  const letters = organizerSlug.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "IZI"
  return `${letters}-${randomInt(1000, 10_000)}`
}

export function holdDeadline(event: Event, now = new Date()) {
  return event.priceUzs > 0 ? new Date(now.getTime() + event.holdMinutes * 60_000) : null
}

/** Held spots whose payment time ran out are released; the waitlist moves up. */
export async function expireHolds(db: Db, eventId?: string, now = new Date()) {
  const expired = await db
    .update(registrations)
    .set({ status: "expired", holdExpiresAt: null, updatedAt: now })
    .where(
      and(
        eq(registrations.status, "held"),
        isNotNull(registrations.holdExpiresAt),
        lt(registrations.holdExpiresAt, now),
        eventId ? eq(registrations.eventId, eventId) : undefined,
      ),
    )
    .returning({ eventId: registrations.eventId })
  for (const id of new Set(expired.map((r) => r.eventId))) await promoteWaitlist(db, id, now)
  return expired.length
}

export async function activeCount(db: Db, eventId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), inArray(registrations.status, ACTIVE)))
  return row?.n ?? 0
}

/** Moves the earliest waitlisted people into held spots while there is room. */
export async function promoteWaitlist(db: Db, eventId: string, now = new Date()) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event || event.status !== "published") return []
  const free = event.capacity - (await activeCount(db, eventId))
  if (free <= 0) return []
  const waiting = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "waitlist")))
    .orderBy(asc(registrations.createdAt))
    .limit(free)
  const promoted: Registration[] = []
  for (const r of waiting) {
    const deadline = holdDeadline(event, now)
    const [updated] = await db
      .update(registrations)
      .set({ status: deadline ? "held" : "confirmed", holdExpiresAt: deadline, updatedAt: now })
      .where(eq(registrations.id, r.id))
      .returning()
    promoted.push(updated)
  }
  return promoted
}

export async function register(db: Db, event: Event, organizerSlug: string, userId: string, input: RegisterInput, now = new Date()) {
  if (event.status !== "published" || event.startsAt < now) throw new RegistrationError("closed")
  await expireHolds(db, event.id, now)

  const [existing] = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.eventId, event.id), eq(registrations.userId, userId)))
    .limit(1)
  if (existing && !["expired", "cancelled", "rejected"].includes(existing.status)) throw new RegistrationError("already")

  const full = (await activeCount(db, event.id)) >= event.capacity
  const deadline = holdDeadline(event, now)
  const status: RegistrationStatus = full ? "waitlist" : deadline ? "held" : "confirmed"
  const values = {
    name: input.name,
    phone: input.phone,
    note: input.note,
    status,
    holdExpiresAt: full ? null : deadline,
    rejectReason: null,
    decidedAt: null,
    decidedBy: null,
    updatedAt: now,
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = referenceCode(organizerSlug)
    try {
      if (existing) {
        const [updated] = await db
          .update(registrations)
          .set({ ...values, referenceCode: code })
          .where(eq(registrations.id, existing.id))
          .returning()
        return updated
      }
      const [created] = await db
        .insert(registrations)
        .values({ ...values, eventId: event.id, userId, referenceCode: code })
        .returning()
      return created
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code
      if (code !== "23505" || attempt === 4) throw error
    }
  }
  throw new Error("unreachable")
}

export async function getRegistration(db: Db, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db
    .select({ registration: registrations, event: events, organizer: organizers })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(eq(registrations.id, id))
    .limit(1)
  return row ?? null
}

export async function listUserRegistrations(db: Db, userId: string) {
  return db
    .select({ registration: registrations, event: events, organizer: organizers })
    .from(registrations)
    .innerJoin(events, eq(events.id, registrations.eventId))
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(eq(registrations.userId, userId))
    .orderBy(desc(events.startsAt))
}

export async function listEventRegistrations(db: Db, eventId: string) {
  const rows = await db.select().from(registrations).where(eq(registrations.eventId, eventId)).orderBy(asc(registrations.createdAt))
  const latest = new Map<string, string>()
  if (rows.length > 0) {
    const found = await db
      .select({ id: receipts.id, registrationId: receipts.registrationId })
      .from(receipts)
      .where(
        inArray(
          receipts.registrationId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(desc(receipts.createdAt))
    for (const r of found) if (!latest.has(r.registrationId)) latest.set(r.registrationId, r.id)
  }
  return rows.map((registration) => ({ registration, receiptId: latest.get(registration.id) ?? null }))
}

export function countByStatus(rows: { registration: Registration }[]) {
  const counts: Partial<Record<RegistrationStatus, number>> = {}
  for (const { registration } of rows) counts[registration.status] = (counts[registration.status] ?? 0) + 1
  return counts
}

/**
 * Attendee uploads the receipt: held → proof_sent. A rejected attendee
 * registers again instead (their spot may have gone to the waitlist).
 */
export async function attachReceipt(db: Db, registrationId: string, contentType: string, data: Buffer, now = new Date()) {
  const [reg] = await db.select().from(registrations).where(eq(registrations.id, registrationId)).limit(1)
  if (!reg) throw new RegistrationError("notFound")
  if (reg.status !== "held" && reg.status !== "proof_sent") throw new RegistrationError("badState")
  if (reg.status === "held" && reg.holdExpiresAt && reg.holdExpiresAt < now) throw new RegistrationError("badState")
  await db.insert(receipts).values({ registrationId, contentType, data })
  const [updated] = await db
    .update(registrations)
    .set({ status: "proof_sent", holdExpiresAt: null, rejectReason: null, updatedAt: now })
    .where(eq(registrations.id, registrationId))
    .returning()
  return updated
}

export async function getReceipt(db: Db, receiptId: string) {
  if (!isUuid(receiptId)) return null
  const [row] = await db
    .select({ receipt: receipts, registration: registrations })
    .from(receipts)
    .innerJoin(registrations, eq(registrations.id, receipts.registrationId))
    .where(eq(receipts.id, receiptId))
    .limit(1)
  return row ?? null
}

/** Organizer decision. Rejecting frees the spot; the waitlist moves up. */
export async function decide(
  db: Db,
  eventId: string,
  registrationId: string,
  decision: "confirmed" | "rejected",
  byUserId: string,
  reason = "",
  now = new Date(),
) {
  const [updated] = await db
    .update(registrations)
    .set({
      status: decision,
      holdExpiresAt: null,
      rejectReason: decision === "rejected" ? reason || null : null,
      decidedAt: now,
      decidedBy: byUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(registrations.eventId, eventId),
        inArray(registrations.status, ["held", "proof_sent", "confirmed", "rejected"]),
      ),
    )
    .returning()
  if (!updated) throw new RegistrationError("notFound")
  if (decision === "rejected") await promoteWaitlist(db, eventId, now)
  return updated
}

/** Attendee cancels their own place. */
export async function cancelRegistration(db: Db, registrationId: string, userId: string, now = new Date()) {
  const [updated] = await db
    .update(registrations)
    .set({ status: "cancelled", holdExpiresAt: null, updatedAt: now })
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(registrations.userId, userId),
        inArray(registrations.status, ["held", "proof_sent", "confirmed", "waitlist"]),
      ),
    )
    .returning()
  if (!updated) throw new RegistrationError("notFound")
  await promoteWaitlist(db, updated.eventId, now)
  return updated
}

/** Receipts are personal data: dropped 30 days after the event. */
export async function purgeOldReceipts(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000)
  const old = await db
    .select({ id: receipts.id })
    .from(receipts)
    .innerJoin(registrations, eq(registrations.id, receipts.registrationId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(lt(events.startsAt, cutoff))
  if (old.length === 0) return 0
  await db.delete(receipts).where(
    inArray(
      receipts.id,
      old.map((r) => r.id),
    ),
  )
  return old.length
}

export class CheckInError extends Error {
  constructor(public readonly code: "notFound" | "notConfirmed") {
    super(code)
  }
}

/**
 * Marks a confirmed registration as checked in. Idempotent: a second scan
 * returns the first check-in time, so the door staff see "already in".
 */
export async function checkIn(db: Db, eventId: string, registrationId: string, byUserId: string, at = new Date()) {
  const [reg] = await db
    .select()
    .from(registrations)
    .where(and(eq(registrations.id, registrationId), eq(registrations.eventId, eventId)))
    .limit(1)
  if (!reg) throw new CheckInError("notFound")
  if (reg.status !== "confirmed") throw new CheckInError("notConfirmed")
  if (reg.checkedInAt) return { registration: reg, already: true as const }
  const [updated] = await db
    .update(registrations)
    .set({ checkedInAt: at, checkedInBy: byUserId, updatedAt: at })
    .where(and(eq(registrations.id, registrationId), isNull(registrations.checkedInAt)))
    .returning()
  // Lost the race to another device: report that one's time.
  if (!updated) return { registration: (await db.select().from(registrations).where(eq(registrations.id, registrationId)))[0], already: true as const }
  return { registration: updated, already: false as const }
}

/** Undo a mistaken check-in. */
export async function undoCheckIn(db: Db, eventId: string, registrationId: string, now = new Date()) {
  const [updated] = await db
    .update(registrations)
    .set({ checkedInAt: null, checkedInBy: null, updatedAt: now })
    .where(and(eq(registrations.id, registrationId), eq(registrations.eventId, eventId)))
    .returning()
  return updated ?? null
}
