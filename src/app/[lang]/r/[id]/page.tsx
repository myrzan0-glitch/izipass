import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Ban, CalendarDays, CalendarX2, Check, ChevronLeft, Clock, ExternalLink, Hourglass, LoaderCircle, MapPin, Send, X } from "lucide-react"

import { cancelRegistrationAction } from "@/app/[lang]/r/actions"
import { AddToCalendar } from "@/components/add-to-calendar"
import { ConfirmAction } from "@/components/confirm-action"
import { ConnectTelegram } from "@/components/connect-telegram"
import { CopyButton } from "@/components/copy-button"
import { Countdown } from "@/components/countdown"
import { OrgMark } from "@/components/org-mark"
import { OrganizerLinks } from "@/components/organizer-links"
import { PageSkeleton } from "@/components/page-skeleton"
import { ReceiptUpload } from "@/components/receipt-upload"
import { SiteHeader } from "@/components/site-header"
import { TicketCard } from "@/components/ticket-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { requireUser } from "@/lib/auth/current"
import { calendarEventFor, googleCalendarUrl } from "@/lib/calendar"
import { db } from "@/lib/db"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { describePaymentTo, paymentDetails } from "@/lib/payment-text"
import { expireHolds, getRegistration, latestReceiptId } from "@/lib/registrations"
import { SITE_URL, TELEGRAM_BOT } from "@/lib/site"
import { cn } from "@/lib/utils"
import { ticketUrl } from "@/lib/tickets"
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/time"
import { notifyLater } from "@/lib/telegram/notify"

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[id]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).status.title, robots: { index: false } }
}

type Props = { params: PageProps<"/[lang]/r/[id]">["params"]; searchParams: PageProps<"/[lang]/r/[id]">["searchParams"] }

type StepState = "done" | "now" | "todo"

/** One line of the "what happens next" list: a check, a spinner, or an empty circle. */
function Step({ state, title, hint }: { state: StepState; title: string; hint: string }) {
  return (
    <li className="flex items-start gap-3">
      {state === "done" ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" />
        </span>
      ) : state === "now" ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary">
          <LoaderCircle className="size-3.5 animate-spin" />
        </span>
      ) : (
        <span className="size-6 shrink-0 rounded-full border" />
      )}
      <div>
        <p className={state === "todo" ? "font-medium text-muted-foreground" : state === "now" ? "font-semibold" : "font-medium"}>{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </li>
  )
}

/** The state of a registration: a round icon, a title and what it means, then any details. */
function StatusCard({
  tone = "neutral",
  icon: Icon,
  spin,
  title,
  description,
  children,
}: {
  tone?: "neutral" | "bad"
  icon: React.ComponentType<{ className?: string }>
  spin?: boolean
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="justify-items-center gap-3 text-center">
        <span className={cn("flex size-12 items-center justify-center rounded-full", tone === "bad" ? "bg-destructive/10 text-destructive" : "bg-muted")}>
          <Icon className={cn("size-5", spin && "animate-spin")} />
        </span>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-balance">{description}</CardDescription>
      </CardHeader>
      {children && <CardContent className="flex flex-col gap-4">{children}</CardContent>}
    </Card>
  )
}

/**
 * A guest's registration: pay and upload the receipt, wait for approval,
 * then the ticket. Every other state is an alert with what to do next.
 */
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
  const g = dict.guest
  const paid = event.priceUzs > 0
  const eventUrl = `/${lang}/o/${organizer.slug}/${event.slug}`
  // A cancelled event shows that and nothing actionable: no paying, no ticket, no cancelling.
  const eventCancelled = event.status === "cancelled"
  const canCancel = !eventCancelled && ["held", "proof_sent", "confirmed", "waitlist"].includes(reg.status)
  const canRegisterAgain = ["expired", "cancelled", "rejected"].includes(reg.status) && event.status === "published"
  const amount = `${formatMoney(event.priceUzs, lang)} ${dict.public.uzs}`
  const payTo = describePaymentTo(event.paymentTo)
  const details = paymentDetails(event.paymentInstructions)
  const receiptId = reg.status === "proof_sent" ? await latestReceiptId(db(), reg.id) : null
  const when = formatDateRange(event.startsAt, event.endsAt, lang)
  const copy = (value: string, label: string) => <CopyButton value={value} label={label} copied={t.copied} />
  // Who to talk to when something went wrong with the payment.
  const contact = organizer.links.length > 0 && (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">{g.contactOrganizer}</p>
      <OrganizerLinks links={organizer.links} />
    </div>
  )
  // How the guest hears about the decision: Telegram if linked, else an offer to link it.
  const updates = user.telegramId ? (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Send className="size-4" />
      {g.connectedNote}
    </p>
  ) : (
    <ConnectTelegram lang={lang} bot={TELEGRAM_BOT} dict={dict} />
  )

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-6 pb-16">
        <Button variant="link" size="sm" className="h-auto w-fit px-0 text-muted-foreground has-[>svg]:px-0" asChild>
          <Link href={eventUrl}>
            <ChevronLeft />
            {t.backToEvent}
          </Link>
        </Button>
        <Link href={eventUrl} className="flex items-center gap-3">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own resized image
            <img src={event.coverUrl} alt="" className="size-12 shrink-0 rounded-md border object-cover" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted">
              <OrgMark name={organizer.name} logoUrl={organizer.logoUrl} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold">{event.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{[when, event.venue].filter(Boolean).join(" · ")}</span>
          </span>
        </Link>

        {eventCancelled ? (
          <StatusCard tone="bad" icon={CalendarX2} title={t.eventCancelledTitle} description={t.eventCancelledBody}>
            {contact}
          </StatusCard>
        ) : (
          <>
            {reg.status === "held" && paid && (
              <>
                {reg.holdExpiresAt && (
                  <Alert>
                    <Clock />
                    <AlertTitle>
                      <Countdown variant="text" deadline={reg.holdExpiresAt.toISOString()} label={g.heldFor} done={t.timeUp} />
                    </AlertTitle>
                    <AlertDescription>{g.heldHint}</AlertDescription>
                  </Alert>
                )}
                <Card>
                  <CardHeader>
                    <CardTitle>{g.payTitle}</CardTitle>
                    <CardDescription>{g.payHint}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">{t.amount}</p>
                        <p className="text-lg font-semibold tabular-nums">{amount}</p>
                      </div>
                      {copy(String(event.priceUzs), t.copy)}
                    </div>
                    {payTo ? (
                      <div className="flex flex-col gap-3">
                        <Separator />
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-muted-foreground">{dict.event.paymentTo}</p>
                            <p className={`font-medium break-all select-all ${payTo.kind === "card" ? "font-mono tabular-nums" : ""}`}>{payTo.display}</p>
                          </div>
                          {copy(payTo.copy, t.copy)}
                        </div>
                        {payTo.kind === "link" && (
                          <Button variant="outline" asChild>
                            <a href={payTo.copy} target="_blank" rel="noopener noreferrer">
                              <ExternalLink />
                              {g.openLink}
                            </a>
                          </Button>
                        )}
                      </div>
                    ) : (
                      // Older events: card numbers and links found in the free text.
                      <>
                        {details.cards.map((card) => (
                          <div key={card} className="flex flex-col gap-3">
                            <Separator />
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-muted-foreground">{t.card}</p>
                                <p className="font-mono font-medium tabular-nums select-all">{card}</p>
                              </div>
                              {copy(card.replace(/ /g, ""), t.copy)}
                            </div>
                          </div>
                        ))}
                        {details.links.map((link) => (
                          <Button key={link} variant="outline" asChild>
                            <a href={link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink />
                              {t.payLink}
                            </a>
                          </Button>
                        ))}
                      </>
                    )}
                    <Separator />
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">{t.reference}</p>
                        <p className="font-mono font-medium select-all">{reg.referenceCode}</p>
                      </div>
                      {copy(reg.referenceCode, t.copy)}
                    </div>
                    <p className="text-sm text-muted-foreground">{t.referenceHint}</p>
                    {event.paymentInstructions && (
                      <>
                        <Separator />
                        <p className="text-sm whitespace-pre-line">{event.paymentInstructions}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-3">
                  <FieldLabel>{g.receipt}</FieldLabel>
                  <ReceiptUpload registrationId={reg.id} ocr={organizer.autoCheck} dict={dict} />
                </div>
              </>
            )}

            {reg.status === "proof_sent" && (
              <>
                <StatusCard icon={LoaderCircle} spin title={g.waiting} description={t.proofSentBody}>
                  <ol className="flex flex-col gap-4">
                    <Step state="done" title={g.stepRegistered} hint={formatDateTime(reg.createdAt, lang)} />
                    <Step state="done" title={g.stepReceipt} hint={amount} />
                    <Step state="now" title={g.stepApprove} hint={g.stepApproveHint} />
                    <Step state="todo" title={g.stepTicket} hint={g.stepTicketHint} />
                  </ol>
                  {receiptId && (
                    <>
                      <Separator />
                      <div className="flex items-center gap-3">
                        <a href={`/api/receipts/${receiptId}`} target="_blank" rel="noopener" className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request image */}
                          <img src={`/api/receipts/${receiptId}`} alt={t.yourReceipt} className="size-12 rounded-md border object-cover" />
                        </a>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.yourReceipt}</p>
                          <p className="text-sm text-muted-foreground">{amount}</p>
                        </div>
                        <div className="w-auto">
                          <ReceiptUpload registrationId={reg.id} ocr={organizer.autoCheck} dict={dict} label={g.replace} variant="outline" compact />
                        </div>
                      </div>
                    </>
                  )}
                </StatusCard>
                {updates}
              </>
            )}

            {reg.status === "confirmed" && (
              <>
                {walletError && (
                  <Alert variant="destructive">
                    <AlertDescription>{dict.errors[`wallet_${walletError}` as keyof Dictionary["errors"]] ?? dict.errors.generic}</AlertDescription>
                  </Alert>
                )}
                <TicketCard
                  lang={lang}
                  registrationId={reg.id}
                  qrValue={ticketUrl(reg.id)}
                  name={reg.name}
                  reference={reg.referenceCode}
                  title={event.title}
                  when={[when, event.venue].filter(Boolean).join(" · ")}
                  dict={dict}
                />
                <Card className="gap-0 py-2">
                  <div className="flex items-center gap-3 px-6 py-2">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-sm">{when}</span>
                    <AddToCalendar
                      googleUrl={googleCalendarUrl(calendarEventFor(event, organizer, lang, SITE_URL))}
                      icsUrl={`/api/events/${event.id}/calendar?lang=${lang}`}
                      dict={dict.public}
                    />
                  </div>
                  {event.venue && (
                    <>
                      <Separator />
                      <div className="flex items-center gap-3 px-6 py-2">
                        <MapPin className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 text-sm">{event.venue}</span>
                        {event.venueUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={event.venueUrl} target="_blank" rel="noopener noreferrer">
                              {g.map}
                            </a>
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              </>
            )}

            {reg.status === "waitlist" && (
              <>
                <StatusCard icon={Hourglass} title={t.waitlistTitle} description={t.waitlistBody} />
                {updates}
              </>
            )}

            {reg.status === "rejected" && (
              <StatusCard tone="bad" icon={X} title={t.rejectedTitle} description={t.rejectedBody}>
                {reg.rejectReason && (
                  <div className="rounded-lg bg-muted p-4 text-left">
                    <p className="text-sm text-muted-foreground">{g.reasonLabel}</p>
                    <p className="font-medium">{reg.rejectReason}</p>
                  </div>
                )}
                {contact}
              </StatusCard>
            )}

            {reg.status === "expired" && <StatusCard icon={Clock} title={t.expiredTitle} description={t.expiredBody} />}

            {reg.status === "cancelled" && <StatusCard icon={Ban} title={t.cancelledTitle} description={dict.confirm.cancelRegistrationBody} />}
          </>
        )}

        {(canRegisterAgain || canCancel) && (
          <div className="flex flex-col gap-2">
            {canRegisterAgain && (
              <Button size="lg" asChild>
                <Link href={`${eventUrl}?register=1`}>{t.registerAgain}</Link>
              </Button>
            )}
            {canCancel && (
              <ConfirmAction
                action={cancelRegistrationAction}
                fields={{ lang, registrationId: reg.id }}
                trigger={t.cancel}
                triggerVariant="ghost"
                triggerSize="default"
                title={dict.confirm.cancelRegistrationTitle}
                description={paid && reg.status !== "waitlist" ? dict.confirm.cancelRegistrationPaidBody : dict.confirm.cancelRegistrationBody}
                confirm={dict.confirm.cancelRegistrationConfirm}
                cancel={dict.confirm.keep}
              />
            )}
          </div>
        )}
      </main>
    </>
  )
}

export default function Page({ params, searchParams }: PageProps<"/[lang]/r/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  )
}
