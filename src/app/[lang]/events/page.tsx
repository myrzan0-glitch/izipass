import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { OrganizeCard } from "@/components/organize-card"
import { PageSkeleton } from "@/components/page-skeleton"
import { Timeline, type Item } from "@/components/event-timeline"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import type { Event, Registration } from "@/lib/db/schema"
import { listEventsForOrganizers } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { listOrganizersForUser } from "@/lib/organizers"
import { listUserRegistrations, registrationCounts } from "@/lib/registrations"

export async function generateMetadata({ params }: PageProps<"/[lang]/events">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).app.events, robots: { index: false } }
}

/** An event shows under Upcoming until six hours after its start. */
const ONGOING_MS = 6 * 3_600_000

/** Statuses a guest still cares about; expired and cancelled registrations drop off. */
const GUEST_VISIBLE: Registration["status"][] = ["held", "proof_sent", "confirmed", "waitlist", "rejected"]

async function Content({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = (await searchParams).tab === "past" ? "past" : "upcoming"
  const user = await requireUser(lang)
  const memberships = await listOrganizersForUser(db(), user.id)
  const [hosted, mine] = await Promise.all([
    listEventsForOrganizers(
      db(),
      memberships.map((m) => m.organizer.id),
    ),
    listUserRegistrations(db(), user.id),
  ])
  const counts = await registrationCounts(
    db(),
    hosted.map((h) => h.event.id),
  )

  const cutoff = new Date().getTime() - ONGOING_MS
  const isUpcoming = (event: Event) => event.startsAt.getTime() >= cutoff
  const items: Item[] = [
    ...hosted.map(({ event, organizer }) => ({ kind: "host" as const, event, organizer, counts: counts.get(event.id) })),
    ...mine
      .filter(({ registration }) => GUEST_VISIBLE.includes(registration.status))
      .map(({ event, organizer, registration }) => ({ kind: "guest" as const, event, organizer, registration })),
  ]
    .filter((item) => isUpcoming(item.event) === (tab === "upcoming"))
    // Upcoming: soonest first. Past: most recent first.
    .sort((a, b) => (tab === "upcoming" ? 1 : -1) * (a.event.startsAt.getTime() - b.event.startsAt.getTime()))

  const t = dict.app
  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      active="events"
      title={t.events}
      actions={
        <Tabs value={tab}>
          <TabsList>
            <TabsTrigger value="upcoming" asChild>
              <Link href={`/${lang}/events`} replace scroll={false}>
                {dict.dashboard.upcoming}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="past" asChild>
              <Link href={`/${lang}/events?tab=past`} replace scroll={false}>
                {dict.dashboard.past}
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      {items.length > 0 ? (
        <Timeline lang={lang} dict={dict} items={items} />
      ) : (
        <p className="text-sm text-muted-foreground">{tab === "upcoming" ? t.noUpcoming : t.noPast}</p>
      )}
      {memberships.length === 0 && <OrganizeCard lang={lang} dict={dict} />}
    </DashboardShell>
  )
}

export default async function EventsPage({ params, searchParams }: PageProps<"/[lang]/events">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} searchParams={searchParams} />
    </Suspense>
  )
}
