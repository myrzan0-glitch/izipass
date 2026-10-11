import { and, eq } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { organizerMembers, organizers, type Organizer } from "@/lib/db/schema"
import type { OrganizerInput } from "@/lib/validation"

export class SlugTakenError extends Error {}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505"
}

/** One organizer per user for now; the schema allows more later. */
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
