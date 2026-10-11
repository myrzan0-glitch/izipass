import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Check, ImageIcon, ScanLine, X } from "lucide-react"

import { decideRegistrationAction } from "@/app/[lang]/dashboard/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { DashboardShell } from "@/components/dashboard-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireOrganizer } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { getEvent } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import type { Registration } from "@/lib/db/schema"
import { countByStatus, expireHolds, listEventRegistrations, type ReceiptSummary } from "@/lib/registrations"
import { notifyLater } from "@/lib/telegram/notify"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]/registrations">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).registrations.title, robots: { index: false } }
}

async function Content({ params }: { params: PageProps<"/[lang]/dashboard/events/[id]/registrations">["params"] }) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { organizer } = await requireOrganizer(lang, `/${lang}/dashboard/events/${id}/registrations`)
  const event = await getEvent(db(), organizer.id, id)
  if (!event) notFound()
  await expireHolds(db(), event.id)
  notifyLater({ eventId: event.id })
  const rows = await listEventRegistrations(db(), event.id)
  const counts = countByStatus(rows)
  const t = dict.registrations
  const taken = (counts.held ?? 0) + (counts.proof_sent ?? 0) + (counts.confirmed ?? 0)
  const autoCheck = organizer.autoCheck && event.priceUzs > 0

  const verdictVariant = { pass: "default", review: "secondary", fail: "destructive" } as const
  const checkCell = (receipt: ReceiptSummary | null) => {
    if (!receipt) return <span className="text-xs text-muted-foreground">—</span>
    if (!receipt.verdict || !receipt.checks) return <span className="text-xs text-muted-foreground">{t.notChecked}</span>
    const checks = receipt.checks
    const details = (Object.keys(t.checks) as (keyof typeof checks)[]).filter((k) => checks[k] !== "ok" && checks[k] !== "skipped")
    return (
      <div className="flex flex-col gap-1">
        <Badge variant={verdictVariant[receipt.verdict]}>{t.verdict[receipt.verdict]}</Badge>
        {details.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {details.map((k) => `${t.checks[k]}: ${t.checkResult[checks[k]]}`).join(" · ")}
          </p>
        )}
      </div>
    )
  }

  const approveForm = (registrationId: string) => (
    <form action={decideRegistrationAction}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="decision" value="confirmed" />
      <Button type="submit" size="sm">
        <Check />
        {t.approve}
      </Button>
    </form>
  )
  const rejectDialog = (r: Registration) => (
    <ConfirmAction
      action={decideRegistrationAction}
      fields={{ lang, eventId: event.id, registrationId: r.id, decision: "rejected" }}
      trigger={
        <>
          <X />
          {t.reject}
        </>
      }
      title={fmt(dict.confirm.rejectTitle, { name: r.name })}
      description={fmt(dict.confirm.rejectBody, { name: r.name })}
      confirm={dict.confirm.rejectConfirm}
      cancel={dict.confirm.keep}
      reason={{ name: "reason", label: dict.confirm.rejectReason, placeholder: dict.confirm.rejectReasonPlaceholder }}
    />
  )
  const actions = (r: Registration) => {
    if (r.status === "proof_sent" || r.status === "held") {
      return (
        <>
          {approveForm(r.id)}
          {rejectDialog(r)}
        </>
      )
    }
    if (r.status === "confirmed" && event.priceUzs > 0) return rejectDialog(r)
    return null
  }
  const statusBlock = (r: Registration) => (
    <div className="flex flex-col items-start gap-1">
      <RegistrationStatusBadge status={r.status} dict={dict.registrationStatus} />
      {r.checkedInAt && <p className="text-xs text-muted-foreground">{dict.ticket.checkedIn}</p>}
      {r.status === "confirmed" && r.decidedAt && !r.decidedBy && <p className="text-xs text-muted-foreground">{t.autoConfirmed}</p>}
      {r.rejectReason && <p className="text-xs text-muted-foreground">{r.rejectReason}</p>}
    </div>
  )
  const receiptButton = (receiptId: string | null) =>
    receiptId ? (
      <Button variant="outline" size="sm" asChild>
        <a href={`/api/receipts/${receiptId}`} target="_blank" rel="noopener">
          <ImageIcon />
          {t.openReceipt}
        </a>
      </Button>
    ) : null

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={event.title}
      description={fmt(t.summary, { taken, capacity: event.capacity, waitlist: counts.waitlist ?? 0 })}
      back={{ href: `/${lang}/dashboard/events/${event.id}`, label: dict.event.editTitle }}
      actions={
        <>
          {(counts.proof_sent ?? 0) > 0 && <Badge>{fmt(t.toReview, { n: counts.proof_sent ?? 0 })}</Badge>}
          <Badge variant="secondary">{fmt(t.confirmedCount, { n: counts.confirmed ?? 0 })}</Badge>
          <Button size="sm" asChild>
            <Link href={`/${lang}/dashboard/events/${event.id}/scan`}>
              <ScanLine />
              {dict.scan.title}
            </Link>
          </Button>
        </>
      }
    >
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          {rows.length === 0 && <CardDescription>{t.empty}</CardDescription>}
        </CardHeader>
        {rows.length > 0 && (
          <>
            {/* Phones: one card per person, actions within reach. */}
            <CardContent className="flex flex-col gap-3 md:hidden">
              {rows.map(({ registration: r, receipt, receiptId }) => (
                <div key={r.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                        <a href={`tel:${r.phone}`} className="hover:underline">
                          {r.phone}
                        </a>
                        <span className="font-mono">{r.referenceCode}</span>
                      </p>
                    </div>
                    {statusBlock(r)}
                  </div>
                  {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
                  {autoCheck && receipt && <div>{checkCell(receipt)}</div>}
                  {(receiptId || actions(r)) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {receiptButton(receiptId)}
                      {actions(r)}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
            <CardContent className="hidden px-3 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.register.name}</TableHead>
                    <TableHead>{dict.register.phone}</TableHead>
                    <TableHead>{dict.status.reference}</TableHead>
                    <TableHead>{dict.common.status}</TableHead>
                    <TableHead>{t.receipt}</TableHead>
                    {autoCheck && <TableHead>{t.check}</TableHead>}
                    <TableHead className="text-right">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ registration: r, receipt, receiptId }) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.note && <p className="text-xs font-normal text-muted-foreground">{r.note}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <a href={`tel:${r.phone}`} className="hover:underline">
                          {r.phone}
                        </a>
                      </TableCell>
                      <TableCell className="font-mono">{r.referenceCode}</TableCell>
                      <TableCell>{statusBlock(r)}</TableCell>
                      <TableCell>{receiptButton(receiptId) ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      {autoCheck && <TableCell>{checkCell(receipt)}</TableCell>}
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">{actions(r)}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </>
        )}
      </Card>
    </DashboardShell>
  )
}

export default function Page({ params }: PageProps<"/[lang]/dashboard/events/[id]/registrations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
