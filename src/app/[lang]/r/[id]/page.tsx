import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, ExternalLink, MapPin } from "lucide-react"

import { cancelRegistrationAction } from "@/app/[lang]/r/actions"
import { AddToCalendar } from "@/components/add-to-calendar"
import { ConfirmAction } from "@/components/confirm-action"
import { CopyButton } from "@/components/copy-button"
import { Countdown } from "@/components/countdown"
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
import { calendarEventFor, googleCalendarUrl } from "@/lib/calendar"
import { db } from "@/lib/db"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { paymentDetails } from "@/lib/payment-text"
import { expireHolds, getRegistration, latestReceiptId } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"
import { ticketUrl } from "@/lib/tickets"
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/time"
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
  // A cancelled event shows that and nothing actionable: no paying, no ticket, no cancelling.
  const eventCancelled = event.status === "cancelled"
  const canCancel = !eventCancelled && ["held", "proof_sent", "confirmed", "waitlist"].includes(reg.status)
  const canRegisterAgain = ["expired", "cancelled", "rejected"].includes(reg.status) && event.status === "published"
  const amount = `${formatMoney(event.priceUzs, lang)} ${dict.public.uzs}`
  const details = paymentDetails(event.paymentInstructions)
  const receiptId = reg.status === "proof_sent" ? await latestReceiptId(db(), reg.id) : null
  const copy = (value: string, label: string) => <CopyButton value={value} label={label} copied={t.copied} />

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
              {formatDateRange(event.startsAt, event.endsAt, lang)}
            </span>
            {event.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {event.venue}
              </span>
            )}
          </div>
        </div>

        {eventCancelled ? (
          <Alert variant="destructive">
            <AlertTitle>{t.eventCancelledTitle}</AlertTitle>
            <AlertDescription>{t.eventCancelledBody}</AlertDescription>
          </Alert>
        ) : (
          <>
            {reg.status === "held" && paid && (
              <Card>
                <CardHeader>
                  <CardTitle>{t.payTitle}</CardTitle>
                  {reg.holdExpiresAt && (
                    <CardDescription className="flex flex-col items-start gap-2">
                      <Countdown deadline={reg.holdExpiresAt.toISOString()} label={t.timeLeft} done={t.timeUp} />
                      {fmt(t.payDeadline, { time: formatDateTime(reg.holdExpiresAt, lang) })}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <ol className="flex flex-col gap-1.5 text-sm">
                    {[fmt(t.stepPay, { amount }), t.stepUpload, t.stepConfirm].map((step, i) => (
                      <li key={step} className="flex gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <Separator />
                  <dl className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <dt className="text-muted-foreground">{t.amount}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{amount}</dd>
                      </div>
                      {copy(String(event.priceUzs), t.copy)}
                    </div>
                    {details.cards.map((card) => (
                      <div key={card} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">{t.card}</dt>
                          <dd className="font-mono font-semibold tabular-nums select-all">{card}</dd>
                        </div>
                        {copy(card.replace(/ /g, ""), t.copy)}
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <dt className="text-muted-foreground">{t.reference}</dt>
                        <dd className="font-mono font-semibold select-all">{reg.referenceCode}</dd>
                      </div>
                      {copy(reg.referenceCode, t.copy)}
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">{t.referenceHint}</p>
                  {details.links.map((link) => (
                    <Button key={link} variant="outline" asChild>
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        {t.payLink}
                      </a>
                    </Button>
                  ))}
                  <Separator />
                  <p className="whitespace-pre-line text-sm">{event.paymentInstructions}</p>
                  <Separator />
                  <ReceiptUpload registrationId={reg.id} ocr={organizer.autoCheck} dict={dict} />
                </CardContent>
              </Card>
            )}

            {reg.status === "proof_sent" && (
              <>
                <Alert>
                  <AlertTitle>{t.proofSentTitle}</AlertTitle>
                  <AlertDescription>{t.proofSentBody}</AlertDescription>
                </Alert>
                {receiptId && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t.yourReceipt}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                      <a
                        href={`/api/receipts/${receiptId}`}
                        target="_blank"
                        rel="noopener"
                        className="block overflow-hidden rounded-md border bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request image */}
                        <img src={`/api/receipts/${receiptId}`} alt={t.yourReceipt} className="mx-auto max-h-72 w-auto object-contain" />
                      </a>
                      <ReceiptUpload
                        registrationId={reg.id}
                        ocr={organizer.autoCheck}
                        dict={dict}
                        label={t.replaceReceipt}
                        variant="outline"
                      />
                    </CardContent>
                  </Card>
                )}
              </>
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
                >
                  <AddToCalendar
                    googleUrl={googleCalendarUrl(calendarEventFor(event, organizer, lang, SITE_URL))}
                    icsUrl={`/api/events/${event.id}/calendar?lang=${lang}`}
                    dict={dict.public}
                    size="lg"
                    className="w-full"
                  />
                </TicketCard>
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
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {canRegisterAgain && (
            <Button asChild>
              <Link href={`${eventUrl}/register`}>{t.registerAgain}</Link>
            </Button>
          )}
          {canCancel && (
            <ConfirmAction
              action={cancelRegistrationAction}
              fields={{ lang, registrationId: reg.id }}
              trigger={t.cancel}
              triggerSize="default"
              title={dict.confirm.cancelRegistrationTitle}
              description={
                paid && reg.status !== "waitlist" ? dict.confirm.cancelRegistrationPaidBody : dict.confirm.cancelRegistrationBody
              }
              confirm={dict.confirm.cancelRegistrationConfirm}
              cancel={dict.confirm.keep}
            />
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
