import { and, asc, count, desc, eq, gte, ne } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { isUuid } from "@/lib/ids"
import { PLAN_LIMITS, events, organizers, type Event, type EventStatus, type Organizer, type Plan } from "@/lib/db/schema"
import { SlugTakenError } from "@/lib/organizers"
import { SLUG_PATTERN } from "@/lib/slug"
import { startOfMonth, toLocalInput } from "@/lib/time"
import type { EventInput } from "@/lib/validation"

export class PlanLimitError extends Error {
  constructor(public readonly limit: "eventsPerMonth" | "participantsPerEvent") {
    super(limit)
  }
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505"
}

/** Events created this calendar month that count against the plan. */
export async function eventsThisMonth(db: Db, organizerId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(events)
    .where(and(eq(events.organizerId, organizerId), ne(events.status, "cancelled"), gte(events.createdAt, startOfMonth())))
  return row?.n ?? 0
}

export function planLimits(organizer: Organizer) {
  const plan: Plan = organizer.plan === "pro" && organizer.planUntil && organizer.planUntil > new Date() ? "pro" : "free"
  return { plan, ...PLAN_LIMITS[plan] }
}

export async function createEvent(db: Db, organizer: Organizer, input: EventInput): Promise<Event> {
  const limits = planLimits(organizer)
  if (input.capacity > limits.participantsPerEvent) throw new PlanLimitError("participantsPerEvent")
  if ((await eventsThisMonth(db, organizer.id)) >= limits.eventsPerMonth) throw new PlanLimitError("eventsPerMonth")
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

export async function setEventStatus(db: Db, organizerId: string, eventId: string, status: EventStatus) {
  const [event] = await db
    .update(events)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .returning()
  return event ?? null
}

export async function listEvents(db: Db, organizerId: string) {
  return db.select().from(events).where(eq(events.organizerId, organizerId)).orderBy(desc(events.startsAt))
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

/** Published, not yet finished events for a public organizer page. */
export async function listPublicEvents(db: Db, organizerId: string, now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000)
  return db
    .select()
    .from(events)
    .where(and(eq(events.organizerId, organizerId), eq(events.status, "published"), gte(events.startsAt, dayAgo)))
    .orderBy(asc(events.startsAt))
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
    paymentInstructions: source.paymentInstructions,
    holdMinutes: source.holdMinutes,
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
