import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin } from "lucide-react"

import { cancelRegistrationAction } from "@/app/[lang]/r/actions"
import { PageSkeleton } from "@/components/page-skeleton"
import { ReceiptUpload } from "@/components/receipt-upload"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { SiteHeader } from "@/components/site-header"
import { TicketCard } from "@/components/ticket-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { requireUser } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { expireHolds, getRegistration } from "@/lib/registrations"
import { ticketUrl } from "@/lib/tickets"
import { formatDateTime, formatMoney } from "@/lib/time"
import { notifyLater } from "@/lib/telegram/notify"

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[id]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).status.title, robots: { index: false } }
}

type Props = { params: PageProps<"/[lang]/r/[id]">["params"]; searchParams: PageProps<"/[lang]/r/[id]">["searchParams"] }

async function Content({ params, searchParams }: Props) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const query = await searchParams
  const walletError = typeof query.wallet === "string" ? query.wallet : null
  const dict = await getDictionary(lang)
  const user = await requireUser(lang, `/${lang}/r/${id}`)
  await expireHolds(db())
  notifyLater({ eventId: null })
  const row = await getRegistration(db(), id)
  if (!row || row.registration.userId !== user.id) notFound()
  const { registration: reg, event, organizer } = row
  const t = dict.status
  const paid = event.priceUzs > 0
  const eventUrl = `/${lang}/o/${organizer.slug}/${event.slug}`
  const canCancel = ["held", "proof_sent", "confirmed", "waitlist"].includes(reg.status)
  const canRegisterAgain = ["expired", "cancelled", "rejected"].includes(reg.status) && event.status === "published"

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link href={eventUrl} className="text-sm text-muted-foreground hover:underline">
            {organizer.name}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
            <RegistrationStatusBadge status={reg.status} dict={dict.registrationStatus} />
          </div>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {formatDateTime(event.startsAt, lang)}
            </span>
            {event.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {event.venue}
              </span>
            )}
          </div>
        </div>

        {reg.status === "held" && paid && (
          <Card>
            <CardHeader>
              <CardTitle>{t.payTitle}</CardTitle>
              <CardDescription>
                {reg.holdExpiresAt && fmt(t.payDeadline, { time: formatDateTime(reg.holdExpiresAt, lang) })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t.amount}</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(event.priceUzs, lang)} {dict.public.uzs}
                </dd>
                <dt className="text-muted-foreground">{t.reference}</dt>
                <dd className="font-mono font-semibold">{reg.referenceCode}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">{t.referenceHint}</p>
              <Separator />
              <p className="whitespace-pre-line text-sm">{event.paymentInstructions}</p>
              <Separator />
              <ReceiptUpload registrationId={reg.id} ocr={organizer.autoCheck} dict={dict} />
            </CardContent>
          </Card>
        )}

        {reg.status === "proof_sent" && (
          <Alert>
            <AlertTitle>{t.proofSentTitle}</AlertTitle>
            <AlertDescription>{t.proofSentBody}</AlertDescription>
          </Alert>
        )}

        {reg.status === "confirmed" && (
          <>
            {walletError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {dict.errors[`wallet_${walletError}` as keyof Dictionary["errors"]] ?? dict.errors.generic}
                </AlertDescription>
              </Alert>
            )}
            <TicketCard
              lang={lang}
              registrationId={reg.id}
              qrValue={ticketUrl(reg.id)}
              name={reg.name}
              reference={reg.referenceCode}
              dict={dict}
            />
          </>
        )}

        {reg.status === "waitlist" && (
          <Alert>
            <AlertTitle>{t.waitlistTitle}</AlertTitle>
            <AlertDescription>{t.waitlistBody}</AlertDescription>
          </Alert>
        )}

        {reg.status === "rejected" && (
          <Alert variant="destructive">
            <AlertTitle>{t.rejectedTitle}</AlertTitle>
            <AlertDescription>{reg.rejectReason || t.rejectedBody}</AlertDescription>
          </Alert>
        )}

        {reg.status === "expired" && (
          <Alert>
            <AlertTitle>{t.expiredTitle}</AlertTitle>
            <AlertDescription>{t.expiredBody}</AlertDescription>
          </Alert>
        )}

        {reg.status === "cancelled" && (
          <Alert>
            <AlertTitle>{t.cancelledTitle}</AlertTitle>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          {canRegisterAgain && (
            <Button asChild>
              <Link href={`${eventUrl}/register`}>{t.registerAgain}</Link>
            </Button>
          )}
          {canCancel && (
            <form action={cancelRegistrationAction}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="registrationId" value={reg.id} />
              <Button type="submit" variant="outline">
                {t.cancel}
              </Button>
            </form>
          )}
          <Button variant="ghost" asChild>
            <Link href={eventUrl}>{t.backToEvent}</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function Page({ params, searchParams }: PageProps<"/[lang]/r/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  )
}
