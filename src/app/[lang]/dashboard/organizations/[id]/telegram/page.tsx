import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { OrgManageShell } from "@/components/org-manage-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { TelegramStatus } from "@/components/telegram-status"
import { requireMemberOrganizer } from "@/lib/auth/current"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizations/[id]/telegram">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).orgs.tabs.telegram, robots: { index: false } }
}

/** Organization → Telegram: whether the bot can deliver receipts and taps. */
async function Content({ params }: Pick<PageProps<"/[lang]/dashboard/organizations/[id]/telegram">, "params">) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { user, organizer } = await requireMemberOrganizer(lang, id, `/${lang}/dashboard/organizations/${id}/telegram`)
  return (
    <OrgManageShell lang={lang} dict={dict} organizer={organizer} tab="telegram">
      <div className="max-w-2xl">
        <TelegramStatus lang={lang} user={user} organizerId={organizer.id} dict={dict} />
      </div>
    </OrgManageShell>
  )
}

export default function OrganizationTelegramPage({ params }: PageProps<"/[lang]/dashboard/organizations/[id]/telegram">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
