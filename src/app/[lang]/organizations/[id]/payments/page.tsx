import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { savePaymentSettingsAction } from "@/app/[lang]/actions"
import { OrgManageShell } from "@/components/org-manage-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { PaymentSettingsForm } from "@/components/payment-settings-form"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { requireMemberOrganizer } from "@/lib/auth/current"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/organizations/[id]/payments">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).orgs.tabs.payments, robots: { index: false } }
}

/** Organization → Payments: receipt auto-check and the card it should match. */
async function Content({ params, searchParams }: PageProps<"/[lang]/organizations/[id]/payments">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { organizer } = await requireMemberOrganizer(lang, id, `/${lang}/organizations/${id}/payments`)

  return (
    <OrgManageShell lang={lang} dict={dict} organizer={organizer} tab="payments">
      {query.saved === "1" && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{dict.organizer.saved}</AlertTitle>
        </Alert>
      )}
      <Card className="max-w-2xl">
        <CardContent>
          <PaymentSettingsForm lang={lang} organizer={organizer} action={savePaymentSettingsAction} dict={dict} />
        </CardContent>
      </Card>
    </OrgManageShell>
  )
}

export default function OrganizationPaymentsPage(props: PageProps<"/[lang]/organizations/[id]/payments">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
