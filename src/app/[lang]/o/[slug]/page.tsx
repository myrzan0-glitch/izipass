import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { db } from "@/lib/db"
import { listPublicEvents } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { getOrganizerBySlug } from "@/lib/organizers"
import { formatDateTime, formatMoney } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/o/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params
  if (!isLocale(lang)) return {}
  const organizer = await getOrganizerBySlug(db(), slug)
  if (!organizer) return {}
  return { title: organizer.name, description: organizer.description || undefined }
}

function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

async function OrganizerPage({ params }: { params: PageProps<"/[lang]/o/[slug]">["params"] }) {
  const { lang, slug } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const organizer = await getOrganizerBySlug(db(), slug)
  if (!organizer) notFound()
  const events = await listPublicEvents(db(), organizer.id)
  const t = dict.public

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <section className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{organizer.name}</h1>
        {organizer.description && <p className="whitespace-pre-line text-muted-foreground">{organizer.description}</p>}
        {organizer.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {organizer.links.map((link) => (
              <Button key={link} variant="outline" size="sm" asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  {hostOf(link)}
                </a>
              </Button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.upcoming}</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noUpcoming}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((e) => (
              <Link key={e.id} href={`/${lang}/o/${organizer.slug}/${e.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:bg-accent/40">
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
                  <CardContent>
                    <Badge variant={e.priceUzs ? "secondary" : "outline"}>
                      {e.priceUzs ? `${formatMoney(e.priceUzs, lang)} ${t.uzs}` : dict.event.free}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
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
