import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Plus } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { EventStatusBadge } from "@/components/event-status"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { eventsThisMonth, listEvents, planLimits } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { getOrganizerForUser } from "@/lib/organizers"
import { AUTO_CHECK_PRICE_UZS } from "@/lib/db/schema"
import { autoCheckUsage, listUserRegistrations, registrationCounts } from "@/lib/registrations"
import { formatDateTime, formatMoney, startOfMonth } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).dashboard.title, robots: { index: false } }
}

type Mine = Awaited<ReturnType<typeof listUserRegistrations>>

/** The person's own registrations: upcoming (soonest first), then past. */
function MyTickets({ lang, dict, mine, now }: { lang: Locale; dict: Dictionary; mine: Mine; now: Date }) {
  const cutoff = now.getTime() - 6 * 3_600_000
  const upcoming = mine.filter((r) => r.event.startsAt.getTime() >= cutoff).reverse()
  const past = mine.filter((r) => r.event.startsAt.getTime() < cutoff)
  const item = ({ registration, event }: Mine[number], dim = false) => (
    <Link
      key={registration.id}
      href={`/${lang}/r/${registration.id}`}
      className={`flex items-center justify-between gap-4 rounded-md border p-3 text-sm hover:bg-accent/40 ${dim ? "opacity-70" : ""}`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{event.title}</span>
        <span className="text-muted-foreground">{formatDateTime(event.startsAt, lang)}</span>
      </span>
      <RegistrationStatusBadge status={registration.status} dict={dict.registrationStatus} />
    </Link>
  )
  return (
    <Card id="tickets" className="gap-4 scroll-mt-6">
      <CardHeader>
        <CardTitle>{dict.dashboard.myTickets}</CardTitle>
        {mine.length === 0 && <CardDescription>{dict.dashboard.noTickets}</CardDescription>}
      </CardHeader>
      {mine.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          {upcoming.map((r) => item(r))}
          {past.length > 0 && <p className="pt-2 text-xs font-medium text-muted-foreground">{dict.dashboard.past}</p>}
          {past.map((r) => item(r, true))}
        </CardContent>
      )}
    </Card>
  )
}

async function Dashboard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const user = await requireUser(lang)
  const organizer = await getOrganizerForUser(db(), user.id)

  const mine = await listUserRegistrations(db(), user.id)
  const now = new Date()

  if (!organizer) {
    return (
      <DashboardShell lang={lang} dict={dict} title={dict.dashboard.title} description={fmt(dict.dashboard.welcome, { name: user.name || user.email || "" })}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <MyTickets lang={lang} dict={dict} mine={mine} now={now} />
          <Card>
            <CardHeader>
              <CardTitle>{dict.dashboard.organizeTitle}</CardTitle>
              <CardDescription>{dict.dashboard.organizeBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href={`/${lang}/dashboard/organizer/new`}>
                  <Plus />
                  {dict.dashboard.organizeCta}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    )
  }

  const [events, used, checked] = await Promise.all([
    listEvents(db(), organizer.id),
    eventsThisMonth(db(), organizer.id),
    organizer.autoCheck ? autoCheckUsage(db(), organizer.id, startOfMonth()) : Promise.resolve(0),
  ])
  const counts = await registrationCounts(
    db(),
    events.map((e) => e.id),
  )
  const progress = (e: (typeof events)[number]) => {
    const c = counts.get(e.id)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="tabular-nums">{fmt(t.taken, { taken: c?.taken ?? 0, capacity: e.capacity })}</span>
        {!!c?.review && <Badge>{fmt(dict.registrations.toReview, { n: c.review })}</Badge>}
      </span>
    )
  }
  const limits = planLimits(organizer)
  const t = dict.dashboard
  const usage = fmt(t.usage, { used, limit: limits.eventsPerMonth, plan: dict.plans[limits.plan] })
  const addOn = organizer.autoCheck ? ` · ${fmt(t.autoCheckUsage, { n: checked, price: formatMoney(AUTO_CHECK_PRICE_UZS, lang) })}` : ""

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={organizer.name}
      description={usage + addOn}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${lang}/o/${organizer.slug}`}>
              <ExternalLink />
              {t.publicPage}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${lang}/dashboard/organizer`}>{t.editOrganizer}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/${lang}/dashboard/events/new`}>
              <Plus />
              {t.newEvent}
            </Link>
          </Button>
        </>
      }
    >
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>{t.events}</CardTitle>
          {events.length === 0 && <CardDescription>{t.noEvents}</CardDescription>}
        </CardHeader>
        {events.length > 0 && (
          <CardContent className="flex flex-col gap-3 md:hidden">
            {events.map((e) => (
              <div key={e.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={`/${lang}/dashboard/events/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{formatDateTime(e.startsAt, lang)}</p>
                    <p className="text-sm text-muted-foreground">{e.priceUzs ? `${formatMoney(e.priceUzs, lang)} ${dict.public.uzs}` : dict.event.free}</p>
                    <div className="text-sm text-muted-foreground">{progress(e)}</div>
                  </div>
                  <EventStatusBadge status={e.status} dict={dict.event.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/${lang}/dashboard/events/${e.id}/registrations`}>{dict.registrations.title}</Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/${lang}/dashboard/events/${e.id}`}>{dict.event.editTitle}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
        {events.length > 0 && (
          <CardContent className="hidden px-3 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.event.title}</TableHead>
                  <TableHead>{dict.event.startsAt}</TableHead>
                  <TableHead className="text-right">{dict.event.capacity}</TableHead>
                  <TableHead className="text-right">{dict.event.price}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.registrations.title}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <Link href={`/${lang}/dashboard/events/${e.id}`} className="hover:underline">
                        {e.title}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(e.startsAt, lang)}</TableCell>
                    <TableCell className="text-right text-sm">{progress(e)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.priceUzs ? formatMoney(e.priceUzs, lang) : <Badge variant="outline">{dict.event.free}</Badge>}
                    </TableCell>
                    <TableCell>
                      <EventStatusBadge status={e.status} dict={dict.event.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/${lang}/dashboard/events/${e.id}/registrations`}>{dict.dashboard.open}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
      {mine.length > 0 && <MyTickets lang={lang} dict={dict} mine={mine} now={now} />}
    </DashboardShell>
  )
}

export default async function DashboardPage({ params }: PageProps<"/[lang]/dashboard">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  return (
    <Suspense
      fallback={<PageSkeleton />}
    >
      <Dashboard lang={lang} dict={dict} />
    </Suspense>
  )
}
