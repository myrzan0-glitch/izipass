import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, Plus, Settings } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { OrganizeCard } from "@/components/organize-card"
import { PageSkeleton } from "@/components/page-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { eventsThisMonth, listPublicEvents, planLimits } from "@/lib/events"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { listOrganizersForUser } from "@/lib/organizers"
import { SITE_URL } from "@/lib/site"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizations">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).orgs.title, robots: { index: false } }
}

async function Content({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const user = await requireUser(lang, `/${lang}/dashboard/organizations`)
  const memberships = await listOrganizersForUser(db(), user.id)
  const t = dict.orgs

  if (memberships.length === 0) {
    return (
      <DashboardShell lang={lang} dict={dict} active="organizations" title={t.title} description={t.emptySubtitle}>
        <OrganizeCard lang={lang} dict={dict} />
      </DashboardShell>
    )
  }

  const rows = await Promise.all(
    memberships.map(async ({ organizer, role }) => {
      const [upcoming, used] = await Promise.all([listPublicEvents(db(), organizer.id), eventsThisMonth(db(), organizer.id)])
      return { organizer, role, upcoming: upcoming.length, used, limits: planLimits(organizer) }
    }),
  )
  const host = new URL(SITE_URL).host

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      active="organizations"
      width="wide"
      title={t.title}
      description={t.subtitle}
      actions={
        <Button variant="outline" asChild>
          <Link href={`/${lang}/dashboard/organizations/new`}>
            <Plus />
            {t.new}
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ organizer, upcoming, used, limits }) => (
          <Card key={organizer.id}>
            <CardHeader className="flex items-center gap-4">
              <Avatar className="size-12 rounded-lg">
                {organizer.logoUrl && <AvatarImage src={organizer.logoUrl} alt="" />}
                <AvatarFallback className="rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
                  {organizer.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="truncate text-lg">{organizer.name}</CardTitle>
                <CardDescription className="truncate font-mono text-xs">
                  {host}/o/{organizer.slug}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>{t.youOrganize}</Badge>
              <Badge variant="outline">{fmt(t.upcoming, { n: upcoming })}</Badge>
              <Badge variant="secondary">{fmt(t.usage, { plan: dict.plans[limits.plan], used, limit: limits.eventsPerMonth })}</Badge>
            </CardContent>
            <CardFooter className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={`/${lang}/dashboard/events/new?org=${organizer.id}`}>
                  <Plus />
                  {dict.app.createEvent}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${lang}/o/${organizer.slug}`}>
                  <ArrowUpRight />
                  {t.publicPage}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${lang}/dashboard/organizations/${organizer.id}`}>
                  <Settings />
                  {t.settings}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
        <Card className="border-dashed bg-transparent shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">{t.anotherTitle}</CardTitle>
            <CardDescription>{t.anotherBody}</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/${lang}/dashboard/organizations/new`}>
                <Plus />
                {t.new}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardShell>
  )
}

export default async function OrganizationsPage({ params }: PageProps<"/[lang]/dashboard/organizations">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} />
    </Suspense>
  )
}
