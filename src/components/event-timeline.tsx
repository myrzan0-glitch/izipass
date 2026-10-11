import Link from "next/link"
import { QrCode } from "lucide-react"

import { OrgMark } from "@/components/org-mark"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Event, Organizer, Registration } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import type { EventCounts } from "@/lib/registrations"
import { formatDayParts, formatMoney, localDay } from "@/lib/time"

export type Item =
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
export function Timeline({ lang, dict, items }: { lang: Locale; dict: Dictionary; items: Item[] }) {
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

