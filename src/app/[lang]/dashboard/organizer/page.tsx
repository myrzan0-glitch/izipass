import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { saveOrganizerAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { OrganizerForm } from "@/components/organizer-form"
import { Card, CardContent } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { requireOrganizer } from "@/lib/auth/current"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizer">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).organizer.editTitle, robots: { index: false } }
}

async function Content({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const { organizer } = await requireOrganizer(lang, `/${lang}/dashboard/organizer`)
  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={dict.organizer.editTitle}
      back={{ href: `/${lang}/dashboard`, label: dict.nav.dashboard }}
    >
      <Card className="max-w-xl">
        <CardContent>
          <OrganizerForm lang={lang} organizer={organizer} action={saveOrganizerAction} dict={dict} />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}

export default async function OrganizerPage({ params }: PageProps<"/[lang]/dashboard/organizer">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} />
    </Suspense>
  )
}
