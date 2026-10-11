import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { saveEventAction } from "@/app/[lang]/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { EventForm } from "@/components/event-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { PLAN_LIMITS } from "@/lib/db/schema"
import { eventsThisMonth, lastPaymentDetails, planLimits } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { listOrganizersForUser } from "@/lib/organizers"

export async function generateMetadata({ params }: PageProps<"/[lang]/events/new">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).create.title, robots: { index: false } }
}

async function Content({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const user = await requireUser(lang, `/${lang}/events/new`)
  const memberships = await listOrganizersForUser(db(), user.id)
  const organizers = await Promise.all(
    memberships.map(async ({ organizer }) => ({
      id: organizer.id,
      name: organizer.name,
      slug: organizer.slug,
      logoUrl: organizer.logoUrl,
      maxCapacity: planLimits(organizer).participantsPerEvent,
      payment: await lastPaymentDetails(db(), organizer.id),
    })),
  )
  const chosen = memberships.find((m) => m.organizer.id === query.org)?.organizer ?? memberships[0]?.organizer
  // Drafts are always allowed; publishing counts against the plan, so warn early.
  const limits = chosen ? planLimits(chosen) : null
  const used = chosen ? await eventsThisMonth(db(), chosen.id) : 0

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      // Opened from My organizations (or for one organization): stay in that section.
      active={query.org || query.from === "organizations" ? "organizations" : "events"}
      width="wide"
    >
      {limits && used >= limits.eventsPerMonth && (
        <Alert>
          <AlertTitle>{dict.errors.eventsPerMonth}</AlertTitle>
          <AlertDescription>{fmt(dict.dashboard.usage, { used, limit: limits.eventsPerMonth, plan: dict.plans[limits.plan] })}</AlertDescription>
        </Alert>
      )}
      <EventForm
        lang={lang}
        event={null}
        section="all"
        organizers={organizers}
        defaultOrganizerId={chosen?.id}
        newOrgMaxCapacity={PLAN_LIMITS.free.participantsPerEvent}
        action={saveEventAction}
        dict={dict}
      />
    </DashboardShell>
  )
}

export default async function NewEventPage({ params, searchParams }: PageProps<"/[lang]/events/new">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} searchParams={searchParams} />
    </Suspense>
  )
}
