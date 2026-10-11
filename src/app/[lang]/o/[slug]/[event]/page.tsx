import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin, Users } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { db } from "@/lib/db"
import { getPublicEvent } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { formatDateTime, formatMoney } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]/[event]">): Promise<Metadata> {
  const { lang, slug, event: eventSlug } = await params
  if (!isLocale(lang)) return {}
  const row = await getPublicEvent(db(), slug, eventSlug)
  if (!row) return {}
  const description = `${formatDateTime(row.event.startsAt, lang)}${row.event.venue ? ` · ${row.event.venue}` : ""}`
  return {
    title: `${row.event.title} · ${row.organizer.name}`,
    description,
    openGraph: { title: row.event.title, description, ...(row.event.coverUrl ? { images: [row.event.coverUrl] } : {}) },
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <article className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link href={`/${lang}/o/${organizer.slug}`} className="text-sm text-muted-foreground hover:underline">
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
              <dd>
                {formatDateTime(event.startsAt, lang)}
                {event.endsAt && ` — ${formatDateTime(event.endsAt, lang)}`}
              </dd>
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
              <dd>{fmt(t.spots, { n: event.capacity })}</dd>
            </div>
          </div>
        </dl>

        {event.description && <p className="whitespace-pre-line text-base leading-relaxed">{event.description}</p>}
      </article>

      <aside className="lg:sticky lg:top-6">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">{dict.event.price}</span>
              <span className="text-xl font-semibold tabular-nums">
                {event.priceUzs ? `${formatMoney(event.priceUzs, lang)} ${t.uzs}` : dict.event.free}
              </span>
            </div>
            {event.status === "published" ? (
              <>
                <Button size="lg" disabled>
                  {t.register}
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t.registrationSoon}</p>
              </>
            ) : (
              <Badge variant="destructive" className="w-fit">
                {dict.event.status.cancelled}
              </Badge>
            )}
          </CardContent>
        </Card>
      </aside>
      </div>
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
