import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { registerAction } from "@/app/[lang]/r/actions"
import { PageSkeleton } from "@/components/page-skeleton"
import { RegisterForm } from "@/components/register-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { getPublicEvent, registrationOpen } from "@/lib/events"
import { isMember } from "@/lib/organizers"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { listUserRegistrations } from "@/lib/registrations"
import { formatDateTime } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]/[event]/register">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).register.title, robots: { index: false } }
}

async function Content({ params }: { params: PageProps<"/[lang]/o/[slug]/[event]/register">["params"] }) {
  const { lang, slug, event: eventSlug } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const user = await requireUser(lang, `/${lang}/o/${slug}/${eventSlug}/register`)
  const row = await getPublicEvent(db(), slug, eventSlug)
  if (!row) notFound()

  // Already registered → go to the status page instead of a duplicate form.
  const mine = (await listUserRegistrations(db(), user.id)).find(
    (r) => r.event.id === row.event.id && !["expired", "cancelled", "rejected"].includes(r.registration.status),
  )
  if (mine) redirect(`/${lang}/r/${mine.registration.id}`)
  // Closed, or the visitor runs this event: back to the event page, which explains why.
  if (!registrationOpen(row.event) || (await isMember(db(), row.organizer.id, user.id))) redirect(`/${lang}/o/${slug}/${eventSlug}`)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <div className="flex justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{row.event.title}</CardTitle>
            <CardDescription>{formatDateTime(row.event.startsAt, lang)}</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm
              lang={lang}
              organizerSlug={slug}
              eventSlug={eventSlug}
              defaults={{ name: user.name }}
              action={registerAction}
              dict={dict}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function Page({ params }: PageProps<"/[lang]/o/[slug]/[event]/register">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
