import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { saveEventAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { EventForm } from "@/components/event-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { requireOrganizer } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { eventsThisMonth, planLimits } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/new">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).event.createTitle, robots: { index: false } }
}

async function Content({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { organizer } = await requireOrganizer(lang, `/${lang}/dashboard/events/new`)
  const limits = planLimits(organizer)
  const used = await eventsThisMonth(db(), organizer.id)
  const atLimit = used >= limits.eventsPerMonth

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={dict.event.createTitle}
      back={{ href: `/${lang}/dashboard`, label: dict.nav.dashboard }}
    >
      {atLimit && (
        <Alert>
          <AlertTitle>{dict.errors.eventsPerMonth}</AlertTitle>
          <AlertDescription>{fmt(dict.dashboard.usage, { used, limit: limits.eventsPerMonth, plan: dict.plans[limits.plan] })}</AlertDescription>
        </Alert>
      )}
      <Card className="max-w-2xl">
        <CardContent>
          <EventForm
            lang={lang}
            event={null}
            organizerSlug={organizer.slug}
            maxCapacity={limits.participantsPerEvent}
            action={saveEventAction}
            dict={dict}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}

export default async function NewEventPage({ params }: PageProps<"/[lang]/dashboard/events/new">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} />
    </Suspense>
  )
}
