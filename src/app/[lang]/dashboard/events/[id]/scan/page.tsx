import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { Scanner } from "@/components/scanner"
import { requireOrganizer } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { getEvent } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]/scan">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).scan.title, robots: { index: false } }
}

async function Content({ params }: { params: PageProps<"/[lang]/dashboard/events/[id]/scan">["params"] }) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { organizer } = await requireOrganizer(lang, `/${lang}/dashboard/events/${id}/scan`)
  const event = await getEvent(db(), organizer.id, id)
  if (!event) notFound()

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={dict.scan.title}
      description={event.title}
      back={{ href: `/${lang}/dashboard/events/${event.id}/registrations`, label: dict.registrations.title }}
    >
      <div className="mx-auto w-full max-w-lg">
        <Scanner lang={lang} eventId={event.id} eventTitle={event.title} dict={dict} />
      </div>
    </DashboardShell>
  )
}

export default function Page({ params }: PageProps<"/[lang]/dashboard/events/[id]/scan">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
