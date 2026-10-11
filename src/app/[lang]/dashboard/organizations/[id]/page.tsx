import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Plus } from "lucide-react"

import { Timeline, type Item } from "@/components/event-timeline"
import { OrgManageShell } from "@/components/org-manage-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireMemberOrganizer } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { listEventsForOrganizers } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { registrationCounts } from "@/lib/registrations"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizations/[id]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).orgs.tabs.events, robots: { index: false } }
}

/** An event shows under Upcoming until six hours after its start (like the Events home). */
const ONGOING_MS = 6 * 3_600_000
/** Old ?tab= links of the settings page. */
const OLD_TABS: Record<string, string> = { profile: "settings", payments: "payments", telegram: "telegram" }

/** An organization's own events: everything it runs, upcoming or past. */
async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/organizations/[id]">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const base = `/${lang}/dashboard/organizations/${id}`
  if (typeof query.tab === "string" && OLD_TABS[query.tab]) redirect(`${base}/${OLD_TABS[query.tab]}${query.saved === "1" ? "?saved=1" : ""}`)
  const dict = await getDictionary(lang)
  const { organizer } = await requireMemberOrganizer(lang, id, base)
  const tab = query.when === "past" ? "past" : "upcoming"
  const rows = await listEventsForOrganizers(db(), [organizer.id])
  const counts = await registrationCounts(
    db(),
    rows.map((r) => r.event.id),
  )
  const cutoff = new Date().getTime() - ONGOING_MS
  const items: Item[] = rows
    .filter(({ event }) => event.startsAt.getTime() >= cutoff === (tab === "upcoming"))
    .sort((a, b) => (tab === "upcoming" ? 1 : -1) * (a.event.startsAt.getTime() - b.event.startsAt.getTime()))
    .map(({ event, organizer: o }) => ({ kind: "host", event, organizer: o, counts: counts.get(event.id) }))

  return (
    <OrgManageShell lang={lang} dict={dict} organizer={organizer} tab="events">
      <Tabs value={tab}>
        <TabsList>
          <TabsTrigger value="upcoming" asChild>
            <Link href={base} replace scroll={false}>
              {dict.dashboard.upcoming}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="past" asChild>
            <Link href={`${base}?when=past`} replace scroll={false}>
              {dict.dashboard.past}
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {items.length > 0 ? (
        <Timeline lang={lang} dict={dict} items={items} />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{dict.orgs.noEvents}</p>
          <Button asChild>
            <Link href={`/${lang}/dashboard/events/new?org=${organizer.id}`}>
              <Plus />
              {dict.app.createEvent}
            </Link>
          </Button>
        </div>
      )}
    </OrgManageShell>
  )
}

export default function OrganizationEventsPage(props: PageProps<"/[lang]/dashboard/organizations/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
