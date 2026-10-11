import { and, asc, count, desc, eq, gt, gte, inArray, lte, ne } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { isUuid } from "@/lib/ids"
import { PLAN_LIMITS, events, organizers, registrations, type Event, type EventStatus, type Organizer, type Plan } from "@/lib/db/schema"
import { setCover } from "@/lib/images"
import { SlugTakenError } from "@/lib/organizers"
import { SLUG_PATTERN } from "@/lib/slug"
import { startOfMonth, toLocalInput } from "@/lib/time"
import type { EventInput } from "@/lib/validation"

export class PlanLimitError extends Error {
  constructor(public readonly limit: "eventsPerMonth" | "participantsPerEvent") {
    super(limit)
  }
}

/** A change the event's current registrations don't allow. `n` is a number for the message. */
export class EventRuleError extends Error {
  constructor(
    public readonly code: "startsInPast" | "capacityBelowTaken" | "hasRegistrations",
    public readonly n = 0,
  ) {
    super(code)
  }
}

/** Registration closes `registrationClosesBefore` minutes before the start. */
export function registrationClosesAt(event: Pick<Event, "startsAt" | "registrationClosesBefore">) {
  return new Date(event.startsAt.getTime() - event.registrationClosesBefore * 60_000)
}

export function registrationOpen(event: Pick<Event, "status" | "startsAt" | "registrationClosesBefore">, now = new Date()) {
  return event.status === "published" && now < registrationClosesAt(event)
}

/** Registrations that still hold a place or wait for one. */
const LIVE_STATUSES = ["held", "proof_sent", "confirmed", "waitlist"] as const

export async function liveRegistrationCount(db: Db, eventId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), inArray(registrations.status, [...LIVE_STATUSES])))
  return row?.n ?? 0
}

async function takenCount(db: Db, eventId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), inArray(registrations.status, ["held", "proof_sent", "confirmed"])))
  return row?.n ?? 0
}

/**
 * Rules for saving an event form: a new or moved start can't be in the past,
 * and the spots can't drop below the places already taken.
 */
export async function checkEventInput(db: Db, input: EventInput, existing: Event | null, now = new Date()) {
  const moved = !existing || existing.startsAt.getTime() !== input.startsAt.getTime()
  if (moved && input.startsAt < now) throw new EventRuleError("startsInPast")
  if (existing) {
    const taken = await takenCount(db, existing.id)
    if (input.capacity < taken) throw new EventRuleError("capacityBelowTaken", taken)
  }
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505"
}

/** Events first published this calendar month and still live: these count against the plan. Drafts don't. */
export async function eventsThisMonth(db: Db, organizerId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(events)
    .where(and(eq(events.organizerId, organizerId), eq(events.status, "published"), gte(events.publishedAt, startOfMonth())))
  return row?.n ?? 0
}

export function planLimits(organizer: Organizer) {
  const plan: Plan = organizer.plan === "pro" && organizer.planUntil && organizer.planUntil > new Date() ? "pro" : "free"
  return { plan, ...PLAN_LIMITS[plan] }
}

export async function createEvent(db: Db, organizer: Organizer, input: EventInput): Promise<Event> {
  // Drafts are free to create; the monthly limit applies when publishing.
  if (input.capacity > planLimits(organizer).participantsPerEvent) throw new PlanLimitError("participantsPerEvent")
  try {
    const [event] = await db.insert(events).values({ ...input, organizerId: organizer.id }).returning()
    return event
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError(input.slug)
    throw error
  }
}

export async function updateEvent(db: Db, organizer: Organizer, eventId: string, input: EventInput): Promise<Event | null> {
  if (input.capacity > planLimits(organizer).participantsPerEvent) throw new PlanLimitError("participantsPerEvent")
  try {
    const [event] = await db
      .update(events)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(events.id, eventId), eq(events.organizerId, organizer.id)))
      .returning()
    return event ?? null
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError(input.slug)
    throw error
  }
}

/**
 * Publish, unpublish or cancel.
 * - Publishing for the first time counts against the monthly plan limit, and needs a future start.
 * - Back to draft only while nobody is registered (their pages would lose the event); cancel instead.
 */
export async function setEventStatus(db: Db, organizerId: string, eventId: string, status: EventStatus, now = new Date()) {
  const event = await getEvent(db, organizerId, eventId)
  if (!event) return null
  if (event.status === status) return event
  const patch: Partial<Event> = { status, updatedAt: now }
  if (status === "published") {
    if (event.startsAt < now) throw new EventRuleError("startsInPast")
    if (!event.publishedAt) {
      const [organizer] = await db.select().from(organizers).where(eq(organizers.id, organizerId)).limit(1)
      if ((await eventsThisMonth(db, organizerId)) >= planLimits(organizer).eventsPerMonth) throw new PlanLimitError("eventsPerMonth")
      patch.publishedAt = now
    }
  }
  if (status === "draft") {
    const live = await liveRegistrationCount(db, eventId)
    if (live > 0) throw new EventRuleError("hasRegistrations", live)
  }
  const [updated] = await db
    .update(events)
    .set(patch)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .returning()
  return updated ?? null
}

/** Drafts with nobody holding or waiting for a place can be deleted (with their cover). */
export async function deleteDraft(db: Db, organizerId: string, eventId: string) {
  const event = await getEvent(db, organizerId, eventId)
  if (!event || event.status !== "draft") return false
  const live = await liveRegistrationCount(db, eventId)
  if (live > 0) throw new EventRuleError("hasRegistrations", live)
  if (event.coverUrl) await setCover(db, organizerId, eventId, null)
  await db.delete(events).where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
  return true
}

export async function listEvents(db: Db, organizerId: string) {
  return db.select().from(events).where(eq(events.organizerId, organizerId)).orderBy(desc(events.startsAt))
}

/** Every event of these organizations, with its organization, newest first. */
export async function listEventsForOrganizers(db: Db, organizerIds: string[]) {
  if (organizerIds.length === 0) return []
  return db
    .select({ event: events, organizer: organizers })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(inArray(events.organizerId, organizerIds))
    .orderBy(desc(events.startsAt))
}

export async function getEvent(db: Db, organizerId: string, eventId: string) {
  if (!isUuid(eventId)) return null
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .limit(1)
  return event ?? null
}

/** Published events that haven't started, soonest first (registration may already be closed). */
export async function listPublicEvents(db: Db, organizerId: string, now = new Date()) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.organizerId, organizerId), eq(events.status, "published"), gt(events.startsAt, now)))
    .orderBy(asc(events.startsAt))
}

/** The organizer's most recent past events, newest first. */
export async function listPastPublicEvents(db: Db, organizerId: string, now = new Date(), limit = 6) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.organizerId, organizerId), eq(events.status, "published"), lte(events.startsAt, now)))
    .orderBy(desc(events.startsAt))
    .limit(limit)
}

export async function getPublicEvent(db: Db, organizerSlug: string, eventSlug: string) {
  const [row] = await db
    .select({ event: events, organizer: organizers })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(and(eq(organizers.slug, organizerSlug), eq(events.slug, eventSlug), ne(events.status, "draft")))
    .limit(1)
  return row ?? null
}

const WEEK_MS = 7 * 86_400_000

/**
 * A copy of an event as a new draft, a week later (or the first week after
 * today, for an old event): weekly clubs repeat the same event. The address
 * gets the new date, e.g. thursday-club-2026-11-12.
 */
export async function duplicateEvent(db: Db, organizer: Organizer, eventId: string, now = new Date()): Promise<Event | null> {
  const source = await getEvent(db, organizer.id, eventId)
  if (!source) return null
  let shift = WEEK_MS
  while (source.startsAt.getTime() + shift < now.getTime()) shift += WEEK_MS
  const startsAt = new Date(source.startsAt.getTime() + shift)
  const endsAt = source.endsAt ? new Date(source.endsAt.getTime() + shift) : null
  const date = toLocalInput(startsAt).slice(0, 10)
  const base = source.slug.replace(/-\d{4}-\d{2}-\d{2}(-\d+)?$/, "").slice(0, 48 - date.length - 4).replace(/-+$/, "")
  const input: EventInput = {
    slug: "",
    title: source.title,
    description: source.description,
    startsAt,
    endsAt,
    venue: source.venue,
    venueUrl: source.venueUrl ?? "",
    capacity: Math.min(source.capacity, planLimits(organizer).participantsPerEvent),
    priceUzs: source.priceUzs,
    paymentTo: source.paymentTo,
    paymentInstructions: source.paymentInstructions,
    holdMinutes: source.holdMinutes,
    registrationClosesBefore: source.registrationClosesBefore,
  }
  for (let n = 1; n <= 20; n++) {
    const slug = [base, date, n > 1 ? String(n) : ""].filter(Boolean).join("-")
    if (!SLUG_PATTERN.test(slug)) continue
    try {
      return await createEvent(db, organizer, { ...input, slug })
    } catch (error) {
      if (!(error instanceof SlugTakenError)) throw error
    }
  }
  throw new SlugTakenError(base)
}

/** A published or cancelled event by id, with its organizer (for public files like .ics). */
export async function getPublicEventById(db: Db, eventId: string) {
  if (!isUuid(eventId)) return null
  const [row] = await db
    .select({ event: events, organizer: organizers })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(and(eq(events.id, eventId), ne(events.status, "draft")))
    .limit(1)
  return row ?? null
}

/** Where the organization's latest event took payments, to fill in the next one. */
export async function lastPaymentDetails(db: Db, organizerId: string) {
  const [row] = await db
    .select({ paymentTo: events.paymentTo, paymentInstructions: events.paymentInstructions })
    .from(events)
    .where(and(eq(events.organizerId, organizerId), gt(events.priceUzs, 0)))
    .orderBy(desc(events.createdAt))
    .limit(1)
  return row ?? { paymentTo: "", paymentInstructions: "" }
}
