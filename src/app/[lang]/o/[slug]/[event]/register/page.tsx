import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { PageSkeleton } from "@/components/page-skeleton"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { getPublicEvent } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { listUserRegistrations } from "@/lib/registrations"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]/[event]/register">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).register.title, robots: { index: false } }
}

/**
 * Old and shared "register" links: after signing in, people land on the
 * event page with the Register dialog open (or on their registration).
 */
async function Content({ params }: { params: PageProps<"/[lang]/o/[slug]/[event]/register">["params"] }) {
  const { lang, slug, event: eventSlug } = await params
  if (!isLocale(lang)) notFound()
  const user = await requireUser(lang, `/${lang}/o/${slug}/${eventSlug}/register`)
  const row = await getPublicEvent(db(), slug, eventSlug)
  if (!row) notFound()
  const mine = (await listUserRegistrations(db(), user.id)).find(
    (r) => r.event.id === row.event.id && !["expired", "cancelled", "rejected"].includes(r.registration.status),
  )
  redirect(mine ? `/${lang}/r/${mine.registration.id}` : `/${lang}/o/${slug}/${eventSlug}?register=1`)
  return null
}

export default function Page({ params }: PageProps<"/[lang]/o/[slug]/[event]/register">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
