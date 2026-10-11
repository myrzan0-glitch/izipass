import "server-only"

import { notFound, redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { getUser } from "@/lib/auth/users"
import { db } from "@/lib/db"
import type { Locale } from "@/lib/i18n/config"
import { getEventForMember, getMemberOrganizer } from "@/lib/organizers"

/** Data access layer for signed-in pages: redirects to login when there is no valid session. */
export async function requireUser(lang: Locale, next = `/${lang}/events`) {
  const session = await getSession()
  const user = session ? await getUser(db(), session.userId) : null
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(next)}`)
  return user
}

/** An organization the signed-in person is a member of; 404 otherwise. */
export async function requireMemberOrganizer(lang: Locale, organizerId: string, next?: string) {
  const user = await requireUser(lang, next)
  const organizer = await getMemberOrganizer(db(), user.id, organizerId)
  if (!organizer) notFound()
  return { user, organizer }
}

/** An event of one of the signed-in person's organizations; 404 otherwise. */
export async function requireEventAccess(lang: Locale, eventId: string, next?: string) {
  const user = await requireUser(lang, next)
  const access = await getEventForMember(db(), user.id, eventId)
  if (!access) notFound()
  return { user, ...access }
}
