import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Plus } from "lucide-react"

import { saveOrganizerAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { EventStatusBadge } from "@/components/event-status"
import { OrganizerForm } from "@/components/organizer-form"
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
import { formatDateTime, formatMoney } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).dashboard.title, robots: { index: false } }
}

async function Dashboard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const user = await requireUser(lang)
  const organizer = await getOrganizerForUser(db(), user.id)

  if (!organizer) {
    return (
      <DashboardShell lang={lang} dict={dict} title={dict.organizer.createTitle} description={dict.organizer.createSubtitle}>
        <Card className="max-w-xl">
          <CardContent>
            <OrganizerForm lang={lang} organizer={null} action={saveOrganizerAction} dict={dict} />
          </CardContent>
        </Card>
      </DashboardShell>
    )
  }

  const [events, used] = await Promise.all([listEvents(db(), organizer.id), eventsThisMonth(db(), organizer.id)])
  const limits = planLimits(organizer)
  const t = dict.dashboard

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={organizer.name}
      description={fmt(t.usage, { used, limit: limits.eventsPerMonth, plan: dict.plans[limits.plan] })}
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
          <CardContent className="px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.event.title}</TableHead>
                  <TableHead>{dict.event.startsAt}</TableHead>
                  <TableHead className="text-right">{dict.event.capacity}</TableHead>
                  <TableHead className="text-right">{dict.event.price}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
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
                    <TableCell className="text-right tabular-nums">{e.capacity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.priceUzs ? formatMoney(e.priceUzs, lang) : <Badge variant="outline">{dict.event.free}</Badge>}
                    </TableCell>
                    <TableCell>
                      <EventStatusBadge status={e.status} dict={dict.event.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
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
