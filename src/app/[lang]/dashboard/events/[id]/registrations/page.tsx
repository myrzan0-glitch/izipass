import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Check, ImageIcon, ScanLine, X } from "lucide-react"

import { decideRegistrationAction } from "@/app/[lang]/dashboard/actions"
import { DashboardShell } from "@/components/dashboard-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireOrganizer } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { getEvent } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { countByStatus, expireHolds, listEventRegistrations, type ReceiptSummary } from "@/lib/registrations"

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

  const decideForm = (registrationId: string, decision: "confirmed" | "rejected") => (
    <form action={decideRegistrationAction} className="flex items-center gap-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="decision" value={decision} />
      {decision === "rejected" && <Input name="reason" placeholder={t.reasonPlaceholder} className="h-8 w-40" maxLength={200} />}
      <Button type="submit" size="sm" variant={decision === "confirmed" ? "default" : "outline"}>
        {decision === "confirmed" ? <Check /> : <X />}
        {decision === "confirmed" ? t.approve : t.reject}
      </Button>
    </form>
  )

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
          <CardContent className="px-3">
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
                    <TableCell>
                      <RegistrationStatusBadge status={r.status} dict={dict.registrationStatus} />
                      {r.checkedInAt && <p className="text-xs text-muted-foreground">{dict.ticket.checkedIn}</p>}
                      {r.status === "confirmed" && r.decidedAt && !r.decidedBy && (
                        <p className="text-xs text-muted-foreground">{t.autoConfirmed}</p>
                      )}
                      {r.rejectReason && <p className="text-xs text-muted-foreground">{r.rejectReason}</p>}
                    </TableCell>
                    <TableCell>
                      {receiptId ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/receipts/${receiptId}`} target="_blank" rel="noopener">
                            <ImageIcon />
                            {t.openReceipt}
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {autoCheck && <TableCell>{checkCell(receipt)}</TableCell>}
                    <TableCell>
                      {(r.status === "proof_sent" || r.status === "held") && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {decideForm(r.id, "confirmed")}
                          {decideForm(r.id, "rejected")}
                        </div>
                      )}
                      {r.status === "confirmed" && event.priceUzs > 0 && (
                        <div className="flex justify-end">{decideForm(r.id, "rejected")}</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
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
