import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { QrCode } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { OrgMark } from "@/components/org-mark"
import { OrganizeCard } from "@/components/organize-card"
import { PageSkeleton } from "@/components/page-skeleton"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import type { Event, Organizer, Registration } from "@/lib/db/schema"
import { listEventsForOrganizers } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { listOrganizersForUser } from "@/lib/organizers"
import { listUserRegistrations, registrationCounts, type EventCounts } from "@/lib/registrations"
import { formatDayParts, formatMoney, localDay } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).app.events, robots: { index: false } }
}

/** An event shows under Upcoming until six hours after its start. */
const ONGOING_MS = 6 * 3_600_000

/** Statuses a guest still cares about; expired and cancelled registrations drop off. */
const GUEST_VISIBLE: Registration["status"][] = ["held", "proof_sent", "confirmed", "waitlist", "rejected"]

type Item =
  | { kind: "host"; event: Event; organizer: Organizer; counts?: EventCounts }
  | { kind: "guest"; event: Event; organizer: Organizer; registration: Registration }

function HostCard({ lang, dict, event, organizer, counts }: Extract<Item, { kind: "host" }> & { lang: Locale; dict: Dictionary }) {
  const t = dict.app
  const manage = `/${lang}/dashboard/events/${event.id}`
  const review = counts?.review ?? 0
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">{formatDayParts(event.startsAt, lang).time}</span>
        <Badge>{t.hosting}</Badge>
        {event.status === "draft" && <Badge variant="secondary">{dict.event.status.draft}</Badge>}
        {event.status === "cancelled" && <Badge variant="destructive">{dict.event.status.cancelled}</Badge>}
      </div>
      <Link href={manage} className="text-lg font-semibold hover:underline">
        {event.title}
      </Link>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} />
        <span className="truncate">{[organizer.name, event.venue].filter(Boolean).join(" · ")}</span>
      </p>
      {event.status === "published" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline">{fmt(t.going, { taken: counts?.taken ?? 0, capacity: event.capacity })}</Badge>
          {review > 0 && <Badge>{fmt(t.receiptsToReview, { n: review })}</Badge>}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={manage}>{event.status === "draft" ? t.finishDraft : t.manage}</Link>
        </Button>
        {review > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${manage}/guests?tab=review`}>{t.reviewReceipts}</Link>
          </Button>
        )}
      </div>
    </>
  )
}

function GuestCard({ lang, dict, event, organizer, registration }: Extract<Item, { kind: "guest" }> & { lang: Locale; dict: Dictionary }) {
  const t = dict.app
  const page = `/${lang}/r/${registration.id}`
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">{formatDayParts(event.startsAt, lang).time}</span>
        <RegistrationStatusBadge status={registration.status} dict={dict.registrationStatus} />
        {event.status === "cancelled" && <Badge variant="destructive">{dict.event.status.cancelled}</Badge>}
      </div>
      <Link href={`/${lang}/o/${organizer.slug}/${event.slug}`} className="text-lg font-semibold hover:underline">
        {event.title}
      </Link>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} />
        <span className="truncate">{[organizer.name, event.venue].filter(Boolean).join(" · ")}</span>
      </p>
      {registration.status === "held" && registration.holdExpiresAt && (
        <p className="pt-1">
          {fmt(t.payBy, { amount: formatMoney(event.priceUzs, lang), time: formatDayParts(registration.holdExpiresAt, lang).time })}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        {registration.status === "confirmed" ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={page}>
              <QrCode />
              {t.myTicket}
            </Link>
          </Button>
        ) : registration.status === "held" ? (
          <Button size="sm" asChild>
            <Link href={page}>{t.pay}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={page}>{t.open}</Link>
          </Button>
        )}
      </div>
    </>
  )
}

function Cover({ event }: { event: Event }) {
  if (!event.coverUrl) {
    return <div aria-hidden className="hidden size-28 shrink-0 rounded-lg border border-dashed sm:block" />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={event.coverUrl} alt="" className="hidden size-28 shrink-0 rounded-lg object-cover sm:block" />
}

/** Events grouped by day: the date on the left (on top on phones), the cards on the right. */
function Timeline({ lang, dict, items }: { lang: Locale; dict: Dictionary; items: Item[] }) {
  const days = new Map<string, Item[]>()
  for (const item of items) {
    const key = localDay(item.event.startsAt)
    days.set(key, [...(days.get(key) ?? []), item])
  }
  return (
    <div className="flex flex-col gap-6">
      {[...days.values()].map((group) => {
        const parts = formatDayParts(group[0].event.startsAt, lang)
        return (
          <section key={localDay(group[0].event.startsAt)} className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-6">
            <h2 className="md:pt-5">
              <span className="font-semibold md:hidden">{parts.short}</span>
              <span className="hidden font-semibold md:block">{parts.day}</span>
              <span className="hidden text-sm text-muted-foreground capitalize md:block">{parts.weekday}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {group.map((item) => (
                <Card key={`${item.kind}-${item.event.id}`} className="flex-row items-start gap-4 px-5 py-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {item.kind === "host" ? <HostCard lang={lang} dict={dict} {...item} /> : <GuestCard lang={lang} dict={dict} {...item} />}
                  </div>
                  <Cover event={item.event} />
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

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
              <Link href={`/${lang}/dashboard`} replace scroll={false}>
                {dict.dashboard.upcoming}
              </Link>
            </TabsTrigger>
            <TabsTrigger value="past" asChild>
              <Link href={`/${lang}/dashboard?tab=past`} replace scroll={false}>
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

export default async function EventsPage({ params, searchParams }: PageProps<"/[lang]/dashboard">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} searchParams={searchParams} />
    </Suspense>
  )
}
