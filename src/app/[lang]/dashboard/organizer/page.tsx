import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { saveOrganizerAction, savePaymentSettingsAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { OrganizerForm } from "@/components/organizer-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { PaymentSettingsForm } from "@/components/payment-settings-form"
import { TelegramStatus } from "@/components/telegram-status"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireOrganizer } from "@/lib/auth/current"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizer">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).organizer.editTitle, robots: { index: false } }
}

const TABS = ["profile", "payments", "telegram"] as const
type Tab = (typeof TABS)[number]

async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/organizer">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const query = await searchParams
  const tab: Tab = TABS.find((t) => t === query.tab) ?? "profile"
  const saved = query.saved === "1"
  const { user, organizer } = await requireOrganizer(lang, `/${lang}/dashboard/organizer`)
  const t = dict.organizer
  const base = `/${lang}/dashboard/organizer`

  return (
    <DashboardShell lang={lang} dict={dict} title={t.editTitle} back={{ href: `/${lang}/dashboard`, label: dict.nav.dashboard }}>
      {/* Each tab is its own page (?tab=), so a save returns to the tab it came from. */}
      <Tabs value={tab} className="max-w-xl gap-6">
        <TabsList className="w-full">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key} asChild>
              <Link href={`${base}?tab=${key}`} replace scroll={false}>
                {t.tabs[key]}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
        {saved && (
          <Alert>
            <CircleCheck />
            <AlertTitle>{t.saved}</AlertTitle>
          </Alert>
        )}
        <TabsContent value="profile">
          <Card>
            <CardContent>
              <OrganizerForm lang={lang} organizer={organizer} action={saveOrganizerAction} dict={dict} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card>
            <CardContent>
              <PaymentSettingsForm lang={lang} organizer={organizer} action={savePaymentSettingsAction} dict={dict} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="telegram">
          {tab === "telegram" && (
            <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
              <TelegramStatus lang={lang} user={user} dict={dict} />
            </Suspense>
          )}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

export default function OrganizerPage(props: PageProps<"/[lang]/dashboard/organizer">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
