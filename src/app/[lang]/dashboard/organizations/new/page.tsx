import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { saveOrganizerAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { OrganizerForm } from "@/components/organizer-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { requireUser } from "@/lib/auth/current"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizations/new">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).orgs.newTitle, robots: { index: false } }
}

/** A new organization: a club or brand with its own public page. */
async function Content({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  await requireUser(lang, `/${lang}/dashboard/organizations/new`)
  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      active="organizations"
      width="narrow"
      back={{ href: `/${lang}/dashboard/organizations`, label: dict.orgs.title }}
    >
      <p className="text-sm text-muted-foreground">{dict.orgs.newSubtitle}</p>
      <OrganizerForm lang={lang} organizer={null} action={saveOrganizerAction} dict={dict} />
    </DashboardShell>
  )
}

export default async function NewOrganizerPage({ params }: PageProps<"/[lang]/dashboard/organizations/new">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} />
    </Suspense>
  )
}
