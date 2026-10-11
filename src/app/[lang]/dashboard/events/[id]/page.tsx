import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, CircleCheck, Clock, Copy, MapPin, Pencil } from "lucide-react"

import { duplicateEventAction, setEventStatusAction } from "@/app/[lang]/dashboard/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { displayStatus } from "@/components/event-status"
import { EventManageShell } from "@/components/event-manage-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { ShareLink } from "@/components/share-link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireEventAccess } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { liveRegistrationCount, registrationClosesAt } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { registrationCounts } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"
import { formatDateRange, formatDateTime } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).manage.tabs.overview, robots: { index: false } }
}

/** Manage event → Overview: the numbers, when and where, sharing and status. */
async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/events/[id]">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { event, organizer } = await requireEventAccess(lang, id, `/${lang}/dashboard/events/${id}`)
  const [counts, live] = await Promise.all([registrationCounts(db(), [event.id]).then((m) => m.get(event.id)), liveRegistrationCount(db(), event.id)])
  const c = counts ?? { taken: 0, review: 0, confirmed: 0, waitlist: 0 }
  const t = dict.manage
  const shown = displayStatus(event, new Date())
  const guests = `/${lang}/dashboard/events/${event.id}/guests`
  const publicUrl = `/${lang}/o/${organizer.slug}/${event.slug}`
  const errorText = (() => {
    const code = typeof query.error === "string" ? query.error : null
    if (!code) return null
    const text = dict.errors[code as keyof Dictionary["errors"]]
    return text ? fmt(text, { n: typeof query.n === "string" ? query.n : "" }) : null
  })()

  const stats = [
    { label: t.going, value: c.taken, of: event.capacity, href: `${guests}?tab=confirmed` },
    { label: t.toReview, value: c.review, href: `${guests}?tab=review` },
    { label: t.waitingToPay, value: c.taken - c.review - c.confirmed, href: `${guests}?tab=all` },
    { label: t.waitlist, value: c.waitlist, href: `${guests}?tab=all` },
  ]
  const statusForm = (status: "draft" | "published", label: string, variant: "default" | "outline") => (
    <form action={setEventStatusAction}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  )
  const statusHint =
    shown === "ended"
      ? dict.event.endedHint
      : event.status === "published" && live > 0
        ? t.liveLocked
        : dict.event.publishingHint[event.status]

  return (
    <EventManageShell lang={lang} dict={dict} event={event} organizer={organizer} tab="overview" review={c.review}>
      {query.duplicated === "1" && (
        <Alert>
          <Copy />
          <AlertDescription>{dict.event.duplicated}</AlertDescription>
        </Alert>
      )}
      {query.saved === "1" && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t.saved}</AlertTitle>
        </Alert>
      )}
      {errorText && (
        <Alert variant="destructive">
          <AlertDescription>{errorText}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, of, href }) => (
          <Link key={label} href={href} className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <Card className="h-full gap-1 px-4 py-4 transition-colors hover:bg-accent/40">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {value}
                {of !== undefined && <span className="text-base font-normal text-muted-foreground"> / {of}</span>}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <CardContent className="flex flex-row gap-4 sm:gap-6">
            {event.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.coverUrl} alt="" className="aspect-square w-24 shrink-0 self-start rounded-lg border object-cover sm:w-48" />
            ) : (
              <Link
                href={`/${lang}/dashboard/events/${event.id}/edit`}
                className="flex aspect-square w-24 shrink-0 items-center justify-center self-start rounded-lg border border-dashed bg-muted/50 p-2 text-center text-xs text-muted-foreground hover:bg-accent/40 sm:w-48 sm:text-sm"
              >
                {dict.create.addCover}
              </Link>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="flex gap-3 text-sm">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {formatDateRange(event.startsAt, event.endsAt, lang)}
              </p>
              {event.venue && (
                <p className="flex gap-3 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {event.venueUrl ? (
                    <a href={event.venueUrl} target="_blank" rel="noopener" className="hover:underline">
                      {event.venue}
                    </a>
                  ) : (
                    event.venue
                  )}
                </p>
              )}
              <p className="flex gap-3 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {fmt(t.closesAt, { time: formatDateTime(registrationClosesAt(event), lang) })}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${lang}/dashboard/events/${event.id}/edit`}>
                    <Pencil />
                    {t.editEvent}
                  </Link>
                </Button>
                <form action={duplicateEventAction}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Copy />
                    {t.duplicateNextWeek}
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {shown === "published" && (
            <Card>
              <CardHeader>
                <CardTitle>{dict.share.title}</CardTitle>
                <CardDescription>{dict.share.hint}</CardDescription>
              </CardHeader>
              <CardContent>
                <ShareLink url={`${SITE_URL}${publicUrl}`} title={event.title} dict={dict.share} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t.statusTitle}</CardTitle>
              <CardDescription>{statusHint}</CardDescription>
            </CardHeader>
            {shown !== "ended" && (
              <CardContent className="flex flex-wrap gap-2">
                {event.status === "draft" && statusForm("published", dict.event.publish, "default")}
                {event.status === "published" && live === 0 && statusForm("draft", dict.event.unpublish, "outline")}
                {event.status === "published" && (
                  <ConfirmAction
                    action={setEventStatusAction}
                    fields={{ lang, eventId: event.id, status: "cancelled" }}
                    trigger={dict.event.cancel}
                    triggerVariant="destructive"
                    title={dict.confirm.cancelEventTitle}
                    description={dict.confirm.cancelEventBody}
                    confirm={dict.confirm.cancelEventConfirm}
                    cancel={dict.confirm.keep}
                  />
                )}
                {event.status === "cancelled" && live === 0 && statusForm("draft", dict.event.restore, "outline")}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </EventManageShell>
  )
}

export default function OverviewPage(props: PageProps<"/[lang]/dashboard/events/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
