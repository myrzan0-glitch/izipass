import Link from "next/link"
import { ArrowUpRight, ChevronRight } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { EventStatusBadge, displayStatus } from "@/components/event-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Event, Organizer } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

export type ManageTab = "overview" | "guests" | "registration" | "more"

type Props = {
  lang: Locale
  dict: Dictionary
  event: Event
  organizer: Organizer
  tab: ManageTab
  /** Receipts waiting for review, shown on the Guests tab. */
  review: number
  children: React.ReactNode
}

/** One event's management pages: organization, title, status and the tabs. */
export function EventManageShell({ lang, dict, event, organizer, tab, review, children }: Props) {
  const base = `/${lang}/dashboard/events/${event.id}`
  const t = dict.manage
  const tabs: { key: ManageTab; href: string }[] = [
    { key: "overview", href: base },
    { key: "guests", href: `${base}/guests` },
    { key: "registration", href: `${base}/registration` },
    { key: "more", href: `${base}/more` },
  ]
  return (
    <DashboardShell lang={lang} dict={dict} active="events" width="wide">
      <div className="flex flex-col gap-4">
        <Link
          href={`/${lang}/dashboard/organizations/${organizer.id}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {organizer.name}
          <ChevronRight className="size-4" />
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight">{event.title}</h1>
          <EventStatusBadge status={displayStatus(event, new Date())} dict={dict.event.status} />
          {event.status !== "draft" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${lang}/o/${organizer.slug}/${event.slug}`}>
                {t.eventPage}
                <ArrowUpRight />
              </Link>
            </Button>
          )}
        </div>
        <Tabs value={tab}>
          <TabsList variant="line" className="w-full justify-start gap-4">
            {tabs.map(({ key, href }) => (
              <TabsTrigger key={key} value={key} className="flex-none" asChild>
                <Link href={href} scroll={false}>
                  {t.tabs[key]}
                  {key === "guests" && review > 0 && <Badge className="h-5 min-w-5 px-1.5 tabular-nums">{review}</Badge>}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </DashboardShell>
  )
}
