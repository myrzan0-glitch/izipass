import { and, eq } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { events, organizerMembers, organizers, type Event, type Organizer } from "@/lib/db/schema"
import { isUuid } from "@/lib/ids"
import { RESERVED_SLUGS, SLUG_PATTERN, slugify } from "@/lib/slug"
import type { OrganizerInput, PaymentSettingsInput } from "@/lib/validation"

export class SlugTakenError extends Error {}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505"
}

export type MemberRole = (typeof organizerMembers.$inferSelect)["role"]

/** Every organization the person is a member of, oldest first. */
export async function listOrganizersForUser(db: Db, userId: string): Promise<{ organizer: Organizer; role: MemberRole }[]> {
  return db
    .select({ organizer: organizers, role: organizerMembers.role })
    .from(organizerMembers)
    .innerJoin(organizers, eq(organizers.id, organizerMembers.organizerId))
    .where(eq(organizerMembers.userId, userId))
    .orderBy(organizerMembers.createdAt)
}

/** An organization the person is a member of, or null. */
export async function getMemberOrganizer(db: Db, userId: string, organizerId: string): Promise<Organizer | null> {
  if (!isUuid(organizerId)) return null
  const [row] = await db
    .select({ organizer: organizers })
    .from(organizerMembers)
    .innerJoin(organizers, eq(organizers.id, organizerMembers.organizerId))
    .where(and(eq(organizerMembers.userId, userId), eq(organizerMembers.organizerId, organizerId)))
    .limit(1)
  return row?.organizer ?? null
}

/** An event with its organization, when the person is a member of that organization. */
export async function getEventForMember(db: Db, userId: string, eventId: string): Promise<{ event: Event; organizer: Organizer } | null> {
  if (!isUuid(eventId)) return null
  const [row] = await db
    .select({ event: events, organizer: organizers })
    .from(events)
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .innerJoin(organizerMembers, and(eq(organizerMembers.organizerId, organizers.id), eq(organizerMembers.userId, userId)))
    .where(eq(events.id, eventId))
    .limit(1)
  return row ?? null
}

/** The person's first organization (oldest membership). */
export async function getOrganizerForUser(db: Db, userId: string): Promise<Organizer | null> {
  const [row] = await db
    .select({ organizer: organizers })
    .from(organizerMembers)
    .innerJoin(organizers, eq(organizers.id, organizerMembers.organizerId))
    .where(eq(organizerMembers.userId, userId))
    .orderBy(organizerMembers.createdAt)
    .limit(1)
  return row?.organizer ?? null
}

export async function createOrganizer(db: Db, userId: string, input: OrganizerInput): Promise<Organizer> {
  try {
    return await db.transaction(async (tx) => {
      const [organizer] = await tx.insert(organizers).values(input).returning()
      await tx.insert(organizerMembers).values({ organizerId: organizer.id, userId, role: "owner" })
      return organizer
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError(input.slug)
    throw error
  }
}

export async function updateOrganizer(db: Db, organizerId: string, input: OrganizerInput): Promise<Organizer> {
  try {
    const [organizer] = await db.update(organizers).set(input).where(eq(organizers.id, organizerId)).returning()
    return organizer
  } catch (error) {
    if (isUniqueViolation(error)) throw new SlugTakenError(input.slug)
    throw error
  }
}

export async function getOrganizerBySlug(db: Db, slug: string): Promise<Organizer | null> {
  const [organizer] = await db.select().from(organizers).where(eq(organizers.slug, slug)).limit(1)
  return organizer ?? null
}

export async function isMember(db: Db, organizerId: string, userId: string) {
  const [row] = await db
    .select({ role: organizerMembers.role })
    .from(organizerMembers)
    .where(and(eq(organizerMembers.organizerId, organizerId), eq(organizerMembers.userId, userId)))
    .limit(1)
  return row?.role ?? null
}

export async function updatePaymentSettings(db: Db, organizerId: string, input: PaymentSettingsInput): Promise<Organizer> {
  const [organizer] = await db.update(organizers).set(input).where(eq(organizers.id, organizerId)).returning()
  return organizer
}

/**
 * A first organization made from just a name (while creating the first event):
 * the address comes from the name, with a number added when it's taken.
 */
export async function createOrganizerFromName(db: Db, userId: string, name: string): Promise<Organizer> {
  const base = slugify(name, 40) || "club"
  for (let n = 1; n <= 30; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    if (!SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) continue
    try {
      return await createOrganizer(db, userId, { slug, name, description: "", links: [] })
    } catch (error) {
      if (!(error instanceof SlugTakenError)) throw error
    }
  }
  throw new SlugTakenError(base)
}
