import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, CircleCheck, MapPin, Users } from "lucide-react"

import { AddToCalendar } from "@/components/add-to-calendar"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { getSession } from "@/lib/auth/session"
import { calendarEventFor, googleCalendarUrl } from "@/lib/calendar"
import { db } from "@/lib/db"
import { registrations } from "@/lib/db/schema"
import { getPublicEvent } from "@/lib/events"
import { activeCount, expireHolds } from "@/lib/registrations"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { SITE_URL } from "@/lib/site"
import { absoluteImageUrl } from "@/lib/images"
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/time"
import { notifyLater } from "@/lib/telegram/notify"
import { and, eq } from "drizzle-orm"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]/[event]">): Promise<Metadata> {
  const { lang, slug, event: eventSlug } = await params
  if (!isLocale(lang)) return {}
  const row = await getPublicEvent(db(), slug, eventSlug)
  if (!row) return {}
  const image = absoluteImageUrl(row.event.coverUrl ?? row.organizer.logoUrl, SITE_URL)
  const description = `${formatDateTime(row.event.startsAt, lang)}${row.event.venue ? ` · ${row.event.venue}` : ""}`
  return {
    title: `${row.event.title} · ${row.organizer.name}`,
    description,
    openGraph: { title: row.event.title, description, ...(image ? { images: [image] } : {}) },
  }
}

async function EventPage({ params }: { params: PageProps<"/[lang]/o/[slug]/[event]">["params"] }) {
  const { lang, slug, event: eventSlug } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const row = await getPublicEvent(db(), slug, eventSlug)
  if (!row) notFound()
  const { event, organizer } = row
  const t = dict.public
  await expireHolds(db(), event.id)
  notifyLater({ eventId: event.id })
  const left = Math.max(0, event.capacity - (await activeCount(db(), event.id)))
  const open = event.status === "published" && event.startsAt > new Date()
  // Someone already registered sees their place instead of a Register button.
  const session = await getSession()
  const [mine] = session
    ? await db()
        .select()
        .from(registrations)
        .where(and(eq(registrations.eventId, event.id), eq(registrations.userId, session.userId)))
        .limit(1)
    : []
  const registered = mine && !["expired", "cancelled", "rejected"].includes(mine.status) ? mine : null
  const registerHref = `/${lang}/o/${organizer.slug}/${event.slug}/register`
  const price = event.priceUzs ? `${formatMoney(event.priceUzs, lang)} ${t.uzs}` : dict.event.free
  const calendar = calendarEventFor(event, organizer, lang, SITE_URL)
  const calendarButton = (
    <AddToCalendar
      googleUrl={googleCalendarUrl(calendar)}
      icsUrl={`/api/events/${event.id}/calendar?lang=${lang}`}
      dict={t}
    />
  )

  return (
    <main className={`mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:py-12 ${open && !registered ? "pb-28 lg:pb-12" : ""}`}>
      <SiteHeader lang={lang} dict={dict} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <article className="flex flex-col gap-6">
        {event.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized image
          <img src={event.coverUrl} alt="" className="aspect-video w-full rounded-xl border object-cover" />
        )}
        <div className="flex flex-col gap-2">
          <Link href={`/${lang}/o/${organizer.slug}`} className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:underline">
            <Avatar className="size-6 rounded-md">
              {organizer.logoUrl && <AvatarImage src={organizer.logoUrl} alt="" className="object-cover" />}
              <AvatarFallback className="rounded-md text-xs">{organizer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            {organizer.name}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{event.title}</h1>
        </div>

        {event.status === "cancelled" && (
          <Alert variant="destructive">
            <AlertTitle>{t.cancelledTitle}</AlertTitle>
            <AlertDescription>{t.cancelledBody}</AlertDescription>
          </Alert>
        )}

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
            <div>
              <dt className="sr-only">{dict.event.startsAt}</dt>
              <dd>{formatDateRange(event.startsAt, event.endsAt, lang)}</dd>
            </div>
          </div>
          {event.venue && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
              <div>
                <dt className="sr-only">{dict.event.venue}</dt>
                <dd>
                  {event.venueUrl ? (
                    <a href={event.venueUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {event.venue}
                    </a>
                  ) : (
                    event.venue
                  )}
                </dd>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
            <div>
              <dt className="sr-only">{dict.event.capacity}</dt>
              <dd>{left > 0 ? fmt(t.spotsLeft, { n: left, total: event.capacity }) : t.full}</dd>
            </div>
          </div>
        </dl>

        {event.status !== "cancelled" && <div>{calendarButton}</div>}

        {event.description && <p className="whitespace-pre-line text-base leading-relaxed">{event.description}</p>}
      </article>

      <aside className="lg:sticky lg:top-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">{t.price}</span>
              <span className="text-xl font-semibold tabular-nums">{price}</span>
            </div>
            {registered ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    <CircleCheck className="size-4" aria-hidden />
                    {t.registeredTitle}
                  </span>
                  <RegistrationStatusBadge status={registered.status} dict={dict.registrationStatus} />
                </div>
                <Button size="lg" asChild>
                  <Link href={`/${lang}/r/${registered.id}`}>{t.openRegistration}</Link>
                </Button>
              </>
            ) : open ? (
              <>
                <Button size="lg" asChild>
                  <Link href={registerHref}>{left > 0 ? t.register : t.joinWaitlist}</Link>
                </Button>
                {left === 0 && <p className="text-center text-xs text-muted-foreground">{t.fullHint}</p>}
              </>
            ) : (
              <Badge variant={event.status === "cancelled" ? "destructive" : "outline"} className="w-fit">
                {event.status === "cancelled" ? dict.event.status.cancelled : t.ended}
              </Badge>
            )}
          </CardContent>
        </Card>
      </aside>
      </div>
      {open && !registered && (
        /* Phones: price and Register stay in reach while reading. */
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold tabular-nums">{price}</span>
              <span className="truncate text-xs text-muted-foreground">{left > 0 ? fmt(t.spotsLeft, { n: left, total: event.capacity }) : t.full}</span>
            </div>
            <Button size="lg" asChild>
              <Link href={registerHref}>{left > 0 ? t.register : t.joinWaitlist}</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

/** The slugs are runtime data, so the whole page streams behind one boundary. */
export default function Page({ params }: PageProps<"/[lang]/o/[slug]/[event]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventPage params={params} />
    </Suspense>
  )
}
