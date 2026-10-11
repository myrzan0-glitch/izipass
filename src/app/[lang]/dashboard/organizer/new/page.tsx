import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { saveOrganizerAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { OrganizerForm } from "@/components/organizer-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { getOrganizerForUser } from "@/lib/organizers"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizer/new">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).organizer.createTitle, robots: { index: false } }
}

/** Becoming an organizer: a page of its own, so attendees' dashboards stay about their tickets. */
async function Content({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const user = await requireUser(lang, `/${lang}/dashboard/organizer/new`)
  if (await getOrganizerForUser(db(), user.id)) redirect(`/${lang}/dashboard`)
  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={dict.organizer.createTitle}
      description={dict.organizer.createSubtitle}
      back={{ href: `/${lang}/dashboard`, label: dict.nav.dashboard }}
    >
      <Card className="max-w-xl">
        <CardContent>
          <OrganizerForm lang={lang} organizer={null} action={saveOrganizerAction} dict={dict} />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}

export default async function NewOrganizerPage({ params }: PageProps<"/[lang]/dashboard/organizer/new">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} />
    </Suspense>
  )
}
