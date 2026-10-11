import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin } from "lucide-react"

import { OrganizerLinks } from "@/components/organizer-links"
import { SiteHeader } from "@/components/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { db } from "@/lib/db"
import { listPastPublicEvents, listPublicEvents, registrationOpen } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { absoluteImageUrl } from "@/lib/images"
import { getOrganizerBySlug } from "@/lib/organizers"
import { registrationCounts } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"
import { formatDateTime, formatMoney } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isLocale(lang)) return {}
  const organizer = await getOrganizerBySlug(db(), slug)
  if (!organizer) return {}
  const logo = absoluteImageUrl(organizer.logoUrl, SITE_URL)
  return {
    title: organizer.name,
    description: organizer.description || undefined,
    openGraph: { title: organizer.name, description: organizer.description || undefined, ...(logo ? { images: [logo] } : {}) },
  }
}

async function OrganizerPage({ params }: { params: PageProps<"/[lang]/o/[slug]">["params"] }) {
  const { lang, slug } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const organizer = await getOrganizerBySlug(db(), slug)
  if (!organizer) notFound()
  const [events, past] = await Promise.all([listPublicEvents(db(), organizer.id), listPastPublicEvents(db(), organizer.id)])
  const counts = await registrationCounts(
    db(),
    events.map((e) => e.id),
  )
  const t = dict.public

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <section className="flex max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-xl">
            {organizer.logoUrl && <AvatarImage src={organizer.logoUrl} alt="" className="object-cover" />}
            <AvatarFallback className="rounded-xl text-xl">{organizer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-semibold tracking-tight">{organizer.name}</h1>
        </div>
        {organizer.description && <p className="whitespace-pre-line text-muted-foreground">{organizer.description}</p>}
        <OrganizerLinks links={organizer.links} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.upcoming}</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noUpcoming}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((e) => {
              const left = Math.max(0, e.capacity - (counts.get(e.id)?.taken ?? 0))
              return (
                <Link key={e.id} href={`/${lang}/o/${organizer.slug}/${e.slug}`} className="group">
                  <Card className={`h-full overflow-hidden transition-colors group-hover:bg-accent/40 ${e.coverUrl ? "pt-0" : ""}`}>
                    {e.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- our own resized image
                      <img src={e.coverUrl} alt="" className="aspect-video w-full object-cover" />
                    )}
                    <CardHeader>
                      <CardTitle>{e.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5">
                        <CalendarDays className="size-4" aria-hidden />
                        {formatDateTime(e.startsAt, lang)}
                      </CardDescription>
                      {e.venue && (
                        <CardDescription className="flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden />
                          {e.venue}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Badge variant={e.priceUzs ? "secondary" : "outline"}>
                        {e.priceUzs ? `${formatMoney(e.priceUzs, lang)} ${t.uzs}` : dict.event.free}
                      </Badge>
                      {!registrationOpen(e) ? (
                        <Badge variant="outline">{t.ended}</Badge>
                      ) : (
                        <Badge variant={left > 0 ? "outline" : "destructive"}>{left > 0 ? fmt(t.spotsLeftShort, { n: left }) : t.soldOut}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t.past}</h2>
          <ul className="flex flex-col divide-y rounded-xl border">
            {past.map((e) => (
              <li key={e.id}>
                <Link href={`/${lang}/o/${organizer.slug}/${e.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-accent/40">
                  <span className="min-w-0 truncate font-medium">{e.title}</span>
                  <span className="shrink-0 text-muted-foreground">{formatDateTime(e.startsAt, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

/** The slug is runtime data, so the whole page streams behind one boundary. */
export default function Page({ params }: PageProps<"/[lang]/o/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrganizerPage params={params} />
    </Suspense>
  )
}
