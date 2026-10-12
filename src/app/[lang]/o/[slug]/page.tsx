import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Plus, Settings } from "lucide-react"

import { OrganizerLinks } from "@/components/organizer-links"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageSkeleton } from "@/components/page-skeleton"
import { db } from "@/lib/db"
import { listPastPublicEvents, listPublicEvents, registrationOpen } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { absoluteImageUrl } from "@/lib/images"
import { getOrganizerBySlug, isMember } from "@/lib/organizers"
import { getSession } from "@/lib/auth/session"
import { registrationCounts } from "@/lib/registrations"
import { shareImage } from "@/lib/share-image"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { TIME_ZONE, formatDate, formatDayParts, formatMoney } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isLocale(lang)) return {}
  const organizer = await getOrganizerBySlug(db(), slug)
  if (!organizer) return {}
  const logo = absoluteImageUrl(organizer.logoUrl, SITE_URL)
  return {
    title: organizer.name,
    description: organizer.description || undefined,
    openGraph: { siteName: SITE_NAME, title: organizer.name, description: organizer.description || undefined, images: [logo ?? shareImage(lang, organizer.name)] },
    twitter: { card: logo ? "summary" : "summary_large_image" },
  }
}

async function OrganizerPage({ params }: { params: PageProps<"/[lang]/o/[slug]">["params"] }) {
  const { lang, slug } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const organizer = await getOrganizerBySlug(db(), slug)
  if (!organizer) notFound()
  const [events, past, session] = await Promise.all([listPublicEvents(db(), organizer.id), listPastPublicEvents(db(), organizer.id), getSession()])
  const counts = await registrationCounts(db(), [...events, ...past].map((e) => e.id))
  // Members see a bar with their tools; everyone else sees the page as is.
  const member = session ? !!(await isMember(db(), organizer.id, session.userId)) : false
  const t = dict.public

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      {member && (
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
            <p className="min-w-0 flex-1 text-sm">{dict.guest.organizerBar}</p>
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/${lang}/events/new?org=${organizer.id}`}>
                <Plus />
                {dict.app.createEvent}
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" asChild>
              <Link href={`/${lang}/organizations/${organizer.id}/settings`}>
                <Settings />
                {dict.orgs.settings}
              </Link>
            </Button>
          </div>
        </div>
      )}
      {organizer.coverUrl && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- our own resized image */}
          <img src={organizer.coverUrl} alt="" className="aspect-[8/3] w-full rounded-xl border object-cover" />
        </div>
      )}
      <main className={`mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pb-16 sm:px-6 ${organizer.coverUrl ? "pt-0" : "pt-10"}`}>
        <section className="flex flex-col gap-4">
          <Avatar className={`size-20 rounded-2xl ${organizer.coverUrl ? "-mt-10 border-4 border-background" : ""}`}>
            {organizer.logoUrl && <AvatarImage src={organizer.logoUrl} alt="" className="object-cover" />}
            <AvatarFallback className="rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground">{organizer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{organizer.name}</h1>
          {organizer.description && <p className="max-w-2xl whitespace-pre-line text-muted-foreground">{organizer.description}</p>}
          <OrganizerLinks links={organizer.links} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t.upcoming}</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noUpcoming}</p>
          ) : (
            events.map((e) => {
              const left = Math.max(0, e.capacity - (counts.get(e.id)?.taken ?? 0))
              const day = formatDayParts(e.startsAt, lang)
              return (
                <Card key={e.id} className="flex-row items-center gap-4 px-4 py-4">
                  <div className="w-14 shrink-0 overflow-hidden rounded-md border text-center">
                    <div className="bg-muted py-0.5 text-xs font-medium text-muted-foreground uppercase">{monthShort(e.startsAt, lang)}</div>
                    <div className="py-0.5 text-xl font-semibold tabular-nums">{dayOfMonth(e.startsAt)}</div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm text-muted-foreground capitalize">
                      {day.weekday} · {day.time}
                    </p>
                    <Link href={`/${lang}/o/${organizer.slug}/${e.slug}`} className="truncate text-lg font-semibold hover:underline">
                      {e.title}
                    </Link>
                    {e.venue && <p className="truncate text-sm text-muted-foreground">{e.venue}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline">{e.priceUzs ? `${formatMoney(e.priceUzs, lang)} ${t.uzs}` : dict.event.free}</Badge>
                      {!registrationOpen(e) ? (
                        <Badge variant="secondary">{t.ended}</Badge>
                      ) : (
                        <Badge variant={left > 0 ? "secondary" : "destructive"}>{left > 0 ? fmt(t.spotsLeftShort, { n: left }) : t.soldOut}</Badge>
                      )}
                    </div>
                  </div>
                  {member && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${lang}/events/${e.id}`}>{dict.app.manage}</Link>
                    </Button>
                  )}
                </Card>
              )
            })
          )}
        </section>

        {past.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{t.past}</h2>
            <Card className="gap-0 py-0">
              {past.map((e, i) => (
                <div key={e.id}>
                  {i > 0 && <Separator />}
                  <Link href={`/${lang}/o/${organizer.slug}/${e.slug}`} className="flex items-center justify-between gap-4 px-6 py-3 text-sm hover:bg-accent/40">
                    <span className="min-w-0 truncate font-medium">{e.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDate(e.startsAt, lang)}
                      {(counts.get(e.id)?.confirmed ?? 0) > 0 && ` · ${fmt(dict.guest.goingCount, { n: counts.get(e.id)?.confirmed ?? 0 })}`}
                    </span>
                  </Link>
                </div>
              ))}
            </Card>
          </section>
        )}
      </main>
    </>
  )
}

const monthShort = (date: Date, lang: Locale) => new Intl.DateTimeFormat(lang, { timeZone: TIME_ZONE, month: "short" }).format(date).replace(".", "")
const dayOfMonth = (date: Date) => new Intl.DateTimeFormat("en", { timeZone: TIME_ZONE, day: "numeric" }).format(date)

/** The slug is runtime data, so the whole page streams behind one boundary. */
export default function Page({ params }: PageProps<"/[lang]/o/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrganizerPage params={params} />
    </Suspense>
  )
}
