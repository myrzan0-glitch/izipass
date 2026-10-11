import { and, eq } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { events, images, organizers } from "@/lib/db/schema"
import { isUuid } from "@/lib/ids"

export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024

/** Images are served from /api/images/<id>; a new upload gets a new id, so URLs can be cached forever. */
export const imageUrl = (id: string) => `/api/images/${id}`
export function imageIdFromUrl(url: string | null | undefined) {
  const id = url?.match(/^\/api\/images\/([0-9a-f-]{36})$/)?.[1]
  return id && isUuid(id) ? id : null
}

/** An absolute URL for previews (Telegram, Open Graph). */
export function absoluteImageUrl(url: string | null | undefined, siteUrl: string) {
  if (!url) return null
  return url.startsWith("/") ? `${siteUrl}${url}` : url
}

export async function getImage(db: Db, id: string) {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(images).where(eq(images.id, id)).limit(1)
  return row ?? null
}

async function removeOld(db: Db, organizerId: string, url: string | null) {
  const old = imageIdFromUrl(url)
  if (old) await db.delete(images).where(and(eq(images.id, old), eq(images.organizerId, organizerId)))
}

/** Sets (or with `data: null` clears) the organizer's logo; the previous image is deleted. */
export async function setLogo(db: Db, organizerId: string, file: { contentType: string; data: Buffer } | null) {
  const [organizer] = await db.select({ logoUrl: organizers.logoUrl }).from(organizers).where(eq(organizers.id, organizerId)).limit(1)
  if (!organizer) return null
  let url: string | null = null
  if (file) {
    const [row] = await db.insert(images).values({ organizerId, kind: "logo", ...file }).returning({ id: images.id })
    url = imageUrl(row.id)
  }
  await db.update(organizers).set({ logoUrl: url }).where(eq(organizers.id, organizerId))
  await removeOld(db, organizerId, organizer.logoUrl)
  return { url }
}

/** Sets (or clears) an event's cover; only for the organizer's own events. */
export async function setCover(db: Db, organizerId: string, eventId: string, file: { contentType: string; data: Buffer } | null) {
  if (!isUuid(eventId)) return null
  const [event] = await db
    .select({ coverUrl: events.coverUrl })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .limit(1)
  if (!event) return null
  let url: string | null = null
  if (file) {
    const [row] = await db.insert(images).values({ organizerId, kind: "cover", ...file }).returning({ id: images.id })
    url = imageUrl(row.id)
  }
  await db.update(events).set({ coverUrl: url, updatedAt: new Date() }).where(eq(events.id, eventId))
  await removeOld(db, organizerId, event.coverUrl)
  return { url }
}

/** Sets (or clears) an organization's wide cover; the previous image is deleted. */
export async function setOrganizerCover(db: Db, organizerId: string, file: { contentType: string; data: Buffer } | null) {
  const [organizer] = await db.select({ coverUrl: organizers.coverUrl }).from(organizers).where(eq(organizers.id, organizerId)).limit(1)
  if (!organizer) return null
  let url: string | null = null
  if (file) {
    const [row] = await db.insert(images).values({ organizerId, kind: "cover", ...file }).returning({ id: images.id })
    url = imageUrl(row.id)
  }
  await db.update(organizers).set({ coverUrl: url }).where(eq(organizers.id, organizerId))
  await removeOld(db, organizerId, organizer.coverUrl)
  return { url }
}
