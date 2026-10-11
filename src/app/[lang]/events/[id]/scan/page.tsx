import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DashboardShell } from "@/components/dashboard-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { Scanner } from "@/components/scanner"
import { requireEventAccess } from "@/lib/auth/current"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/events/[id]/scan">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).scan.title, robots: { index: false } }
}

async function Content({ params }: { params: PageProps<"/[lang]/events/[id]/scan">["params"] }) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { event } = await requireEventAccess(lang, id, `/${lang}/events/${id}/scan`)

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={event.title}
      description={dict.guest.doorCheckIn}
      active="events"
      width="narrow"
      back={{ href: `/${lang}/events/${event.id}/guests`, label: dict.manage.tabs.guests }}
    >
      <div className="mx-auto w-full max-w-lg">
        <Scanner lang={lang} eventId={event.id} eventTitle={event.title} dict={dict} />
      </div>
    </DashboardShell>
  )
}

export default function Page({ params }: PageProps<"/[lang]/events/[id]/scan">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
