import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { saveEventAction } from "@/app/[lang]/dashboard/actions"
import { EventForm } from "@/components/event-form"
import { EventManageShell } from "@/components/event-manage-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { requireEventAccess } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { AUTO_CHECK_PRICE_UZS, PLAN_LIMITS } from "@/lib/db/schema"
import { planLimits } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { registrationCounts } from "@/lib/registrations"
import { formatMoney } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]/registration">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).manage.tabs.registration, robots: { index: false } }
}

/** Manage event → Registration: tickets, payment and the registration window. */
async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/events/[id]/registration">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { event, organizer } = await requireEventAccess(lang, id, `/${lang}/dashboard/events/${id}/registration`)
  const counts = (await registrationCounts(db(), [event.id])).get(event.id)
  const t = dict.manage
  const option = { id: organizer.id, name: organizer.name, slug: organizer.slug, logoUrl: organizer.logoUrl, maxCapacity: planLimits(organizer).participantsPerEvent }

  // Auto-check is set per organization; here it's shown with a way to change it.
  const autoCheck = (
    <Field>
      <FieldLabel>{t.autoCheck}</FieldLabel>
      <p className="flex h-9 items-center text-sm">
        {organizer.autoCheck ? fmt(t.autoCheckOn, { price: formatMoney(AUTO_CHECK_PRICE_UZS, lang) }) : t.autoCheckOff}
      </p>
      <FieldDescription>
        <Link href={`/${lang}/dashboard/organizations/${organizer.id}?tab=payments`}>{t.autoCheckChange}</Link>
      </FieldDescription>
    </Field>
  )

  return (
    <EventManageShell lang={lang} dict={dict} event={event} organizer={organizer} tab="registration" review={counts?.review ?? 0}>
      {query.saved === "1" && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t.saved}</AlertTitle>
        </Alert>
      )}
      <div className="max-w-3xl">
        <EventForm
          lang={lang}
          event={event}
          section="registration"
          organizers={[option]}
          newOrgMaxCapacity={PLAN_LIMITS.free.participantsPerEvent}
          returnTo="registration"
          paymentExtra={autoCheck}
          action={saveEventAction}
          dict={dict}
        />
      </div>
    </EventManageShell>
  )
}

export default function RegistrationPage(props: PageProps<"/[lang]/dashboard/events/[id]/registration">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
