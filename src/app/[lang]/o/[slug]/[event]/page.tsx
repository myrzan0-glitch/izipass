import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { CalendarDays, CircleCheck, Clock, MapPin, Ticket } from "lucide-react"

import { registerAction } from "@/app/[lang]/r/actions"
import { AddToCalendar } from "@/components/add-to-calendar"
import { OrgMark } from "@/components/org-mark"
import { OrganizerLinks } from "@/components/organizer-links"
import { PageSkeleton } from "@/components/page-skeleton"
import { RegisterDialog, RegisterTrigger } from "@/components/register-dialog"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { BackButton } from "@/components/back-button"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getSession } from "@/lib/auth/session"
import { getUser } from "@/lib/auth/users"
import { calendarEventFor, googleCalendarUrl } from "@/lib/calendar"
import { db } from "@/lib/db"
import { registrations } from "@/lib/db/schema"
import { getPublicEvent, registrationClosesAt, registrationOpen } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { absoluteImageUrl } from "@/lib/images"
import { initials } from "@/lib/initials"
import { isMember } from "@/lib/organizers"
import { activeCount, expireHolds, goingPreview } from "@/lib/registrations"
import { shareImage } from "@/lib/share-image"
import { SITE_NAME, SITE_URL, TELEGRAM_BOT } from "@/lib/site"
import { notifyLater } from "@/lib/telegram/notify"
import { formatDateTime, formatDayParts, formatMoney } from "@/lib/time"

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
    openGraph: { siteName: SITE_NAME, title: row.event.title, description, images: [image ?? shareImage(lang, row.event.title)] },
    twitter: { card: image ? "summary" : "summary_large_image" },
  }
}

/** An icon in a small bordered square, next to a two-line fact (date, place). */
function Fact({ icon: Icon, title, detail }: { icon: React.ComponentType<{ className?: string }>; title: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
      </div>
    </div>
  )
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
      <Separator />
    </div>
  )
}

type Props = { params: PageProps<"/[lang]/o/[slug]/[event]">["params"]; searchParams: PageProps<"/[lang]/o/[slug]/[event]">["searchParams"] }

async function EventPage({ params, searchParams }: Props) {
  const { lang, slug, event: eventSlug } = await params
  if (!isLocale(lang)) notFound()
  const query = await searchParams
  const dict = await getDictionary(lang)
  const row = await getPublicEvent(db(), slug, eventSlug)
  if (!row) notFound()
  const { event, organizer } = row
  const t = dict.public
  const g = dict.guest
  await expireHolds(db(), event.id)
  notifyLater({ eventId: event.id })
  const [taken, going] = await Promise.all([activeCount(db(), event.id), goingPreview(db(), event.id)])
  const left = Math.max(0, event.capacity - taken)
  const open = registrationOpen(event)
  const session = await getSession()
  const user = session ? await getUser(db(), session.userId) : null
  // Someone already registered sees their place instead of a Register button.
  const [mine] = user
    ? await db()
        .select()
        .from(registrations)
        .where(and(eq(registrations.eventId, event.id), eq(registrations.userId, user.id)))
        .limit(1)
    : []
  const registered = mine && !["expired", "cancelled", "rejected"].includes(mine.status) ? mine : null
  // The organizer (or staff) sees a way to manage the event instead of Register.
  const runsIt = user ? !!(await isMember(db(), organizer.id, user.id)) : false
  const price = event.priceUzs ? `${formatMoney(event.priceUzs, lang)} ${t.uzs}` : dict.event.free
  const spots = left > 0 ? fmt(t.spotsLeft, { n: left, total: event.capacity }) : t.full
  const day = formatDayParts(event.startsAt, lang)
  const end = event.endsAt ? formatDayParts(event.endsAt, lang).time : null
  const canRegister = open && !registered && !runsIt
  const registerLabel = left > 0 ? t.register : t.joinWaitlist
  const calendar = (
    <AddToCalendar
      googleUrl={googleCalendarUrl(calendarEventFor(event, organizer, lang, SITE_URL))}
      icsUrl={`/api/events/${event.id}/calendar?lang=${lang}`}
      dict={t}
    />
  )

  const page = (
    <>
      <main className={`mx-auto grid w-full max-w-5xl flex-1 content-start gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10 ${canRegister ? "pb-28 lg:pb-16" : ""}`}>
        <BackButton label={dict.app.back} className="-mb-4 lg:col-span-2 lg:-mb-6" />
        <aside className="flex flex-col gap-6">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own resized image
            <img src={event.coverUrl} alt="" className="aspect-square w-full rounded-xl border object-cover" />
          ) : (
            <div aria-hidden className="flex aspect-square w-full items-center justify-center rounded-xl border bg-muted">
              <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} className="size-16 rounded-xl text-2xl" />
            </div>
          )}
          <section className="hidden flex-col gap-3 lg:flex">
            <SideHeading>{g.hostedBy}</SideHeading>
            <Link href={`/${lang}/o/${organizer.slug}`} className="flex items-center gap-2 font-medium hover:underline">
              <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} className="size-6" />
              {organizer.name}
            </Link>
            <OrganizerLinks links={organizer.links} />
          </section>
          {going.count > 0 && (
            <section className="hidden flex-col gap-3 lg:flex">
              <SideHeading>{fmt(g.goingCount, { n: going.count })}</SideHeading>
              <AvatarGroup>
                {going.names.map((name, i) => (
                  <Avatar key={i}>
                    <AvatarFallback>{initials(name).slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ))}
                {going.count > going.names.length && <AvatarGroupCount>+{going.count - going.names.length}</AvatarGroupCount>}
              </AvatarGroup>
            </section>
          )}
        </aside>

        <article className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Link href={`/${lang}/o/${organizer.slug}`} className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:underline lg:hidden">
              <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} />
              {organizer.name}
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{event.title}</h1>
          </div>

          <div className="flex flex-col gap-4">
            <Fact icon={CalendarDays} title={<span className="capitalize">{day.weekday}, {day.day}</span>} detail={end ? `${day.time} – ${end}` : day.time} />
            {event.venue && (
              <Fact
                icon={MapPin}
                title={
                  event.venueUrl ? (
                    <a href={event.venueUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {event.venue}
                    </a>
                  ) : (
                    event.venue
                  )
                }
              />
            )}
            {open && event.registrationClosesBefore > 0 && (
              <Fact icon={Clock} title={dict.event.closesBefore} detail={formatDateTime(registrationClosesAt(event), lang)} />
            )}
          </div>

          {event.status === "cancelled" && (
            <Alert variant="destructive">
              <AlertTitle>{t.cancelledTitle}</AlertTitle>
              <AlertDescription>{t.cancelledBody}</AlertDescription>
            </Alert>
          )}

          {event.status !== "cancelled" && (
            <Card>
              <CardHeader>
                <CardTitle>{g.registration}</CardTitle>
                {canRegister && <CardDescription>{event.priceUzs ? g.howPaid : g.howFree}</CardDescription>}
                {open && (
                  <Badge variant="secondary" className="mt-1">
                    {fmt(g.closes, { time: formatDateTime(registrationClosesAt(event), lang) })}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground">
                  <Ticket className="size-4" />
                </span>
                <div>
                  <p className="text-lg font-semibold tabular-nums">{price}</p>
                  <p className="text-sm text-muted-foreground">{spots}</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-3">
                {runsIt ? (
                  <>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <CircleCheck className="size-4" />
                      {t.organizerView}
                    </p>
                    <Button size="lg" asChild>
                      <Link href={`/${lang}/events/${event.id}`}>{t.manage}</Link>
                    </Button>
                  </>
                ) : registered ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <CircleCheck className="size-4" />
                        {t.registeredTitle}
                      </span>
                      <RegistrationStatusBadge status={registered.status} dict={dict.registrationStatus} />
                    </div>
                    <Button size="lg" asChild>
                      <Link href={`/${lang}/r/${registered.id}`}>{t.openRegistration}</Link>
                    </Button>
                    {calendar}
                  </>
                ) : open ? (
                  <>
                    <RegisterTrigger label={registerLabel} className="w-full" />
                    {left === 0 && <p className="text-center text-sm text-muted-foreground">{t.fullHint}</p>}
                  </>
                ) : (
                  <Badge variant="outline" className="w-fit">
                    {t.ended}
                  </Badge>
                )}
              </CardFooter>
            </Card>
          )}

          {event.description && (
            <section className="flex flex-col gap-3">
              <SideHeading>{g.about}</SideHeading>
              <p className="leading-relaxed whitespace-pre-line">{event.description}</p>
            </section>
          )}

          <section className="flex flex-col gap-3 lg:hidden">
            <SideHeading>{g.hostedBy}</SideHeading>
            <Link href={`/${lang}/o/${organizer.slug}`} className="flex items-center gap-2 font-medium hover:underline">
              <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} className="size-6" />
              {organizer.name}
            </Link>
            <OrganizerLinks links={organizer.links} />
          </section>
        </article>
      </main>
      {canRegister && (
        /* Phones: price and Register stay in reach while reading. */
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold tabular-nums">{price}</span>
              <span className="truncate text-sm text-muted-foreground">{spots}</span>
            </div>
            <RegisterTrigger label={registerLabel} />
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      {canRegister ? (
        <RegisterDialog
          lang={lang}
          organizerSlug={organizer.slug}
          eventSlug={event.slug}
          summary={`${event.title} · ${day.short}, ${day.time}`}
          person={user ? { name: user.name, phone: user.phone } : null}
          bot={TELEGRAM_BOT}
          defaultOpen={query.register === "1"}
          action={registerAction}
          dict={dict}
        >
          {page}
        </RegisterDialog>
      ) : (
        page
      )}
    </>
  )
}

/** The slugs are runtime data, so the whole page streams behind one boundary. */
export default function Page({ params, searchParams }: PageProps<"/[lang]/o/[slug]/[event]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventPage params={params} searchParams={searchParams} />
    </Suspense>
  )
}
