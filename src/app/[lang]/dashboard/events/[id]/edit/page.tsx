import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { saveEventAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { EventForm } from "@/components/event-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { requireEventAccess } from "@/lib/auth/current"
import { PLAN_LIMITS } from "@/lib/db/schema"
import { planLimits } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]/edit">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).manage.editEvent, robots: { index: false } }
}

/** Edit event: name, time, place, description and cover, in the Create event layout. */
async function Content({ params }: Pick<PageProps<"/[lang]/dashboard/events/[id]/edit">, "params">) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { event, organizer } = await requireEventAccess(lang, id, `/${lang}/dashboard/events/${id}/edit`)
  const option = { id: organizer.id, name: organizer.name, slug: organizer.slug, logoUrl: organizer.logoUrl, maxCapacity: planLimits(organizer).participantsPerEvent }

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      active="events"
      width="wide"
      back={{ href: `/${lang}/dashboard/events/${event.id}`, label: event.title }}
    >
      <EventForm
        lang={lang}
        event={event}
        section="details"
        organizers={[option]}
        newOrgMaxCapacity={PLAN_LIMITS.free.participantsPerEvent}
        action={saveEventAction}
        dict={dict}
      />
    </DashboardShell>
  )
}

export default function EditEventPage({ params }: PageProps<"/[lang]/dashboard/events/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
