import "server-only"

import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { getUser } from "@/lib/auth/users"
import { db } from "@/lib/db"
import type { Locale } from "@/lib/i18n/config"
import { getOrganizerForUser } from "@/lib/organizers"

/** Data access layer for signed-in pages: redirects to login when there is no valid session. */
export async function requireUser(lang: Locale, next = `/${lang}/dashboard`) {
  const session = await getSession()
  const user = session ? await getUser(db(), session.userId) : null
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(next)}`)
  return user
}

/** The signed-in user's organizer, or a redirect to the "create organizer" step. */
export async function requireOrganizer(lang: Locale, next?: string) {
  const user = await requireUser(lang, next)
  const organizer = await getOrganizerForUser(db(), user.id)
  if (!organizer) redirect(`/${lang}/dashboard`)
  return { user, organizer }
}
