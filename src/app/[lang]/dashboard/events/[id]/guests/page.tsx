import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Check, Download, ImageIcon, ReceiptText, ScanLine, Search, X } from "lucide-react"

import { decideRegistrationAction } from "@/app/[lang]/dashboard/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { EventManageShell } from "@/components/event-manage-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { ReceiptReview } from "@/components/receipt-review"
import { RegistrationStatusBadge } from "@/components/registration-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireEventAccess } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import type { Registration } from "@/lib/db/schema"
import { countByStatus, expireHolds, listEventRegistrations, type ReceiptSummary } from "@/lib/registrations"
import { notifyLater } from "@/lib/telegram/notify"
import { formatMoney } from "@/lib/time"

const TABS = ["review", "confirmed", "all"] as const
type Tab = (typeof TABS)[number]

/** Search by name, phone (digits only) or reference code. */
function matches(r: Registration, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const digits = needle.replace(/\D/g, "")
  return (
    r.name.toLowerCase().includes(needle) ||
    r.referenceCode.toLowerCase().includes(needle) ||
    (digits.length >= 3 && r.phone.replace(/\D/g, "").includes(digits))
  )
}

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]/guests">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).registrations.title, robots: { index: false } }
}

async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/events/[id]/guests">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { organizer, event } = await requireEventAccess(lang, id, `/${lang}/dashboard/events/${id}/guests`)
  await expireHolds(db(), event.id)
  notifyLater({ eventId: event.id })
  const allRows = await listEventRegistrations(db(), event.id)
  const counts = countByStatus(allRows)
  const t = dict.registrations
  const q = typeof query.q === "string" ? query.q.slice(0, 80) : ""
  const tab: Tab = TABS.find((x) => x === query.tab) ?? ((counts.proof_sent ?? 0) > 0 ? "review" : "all")
  const tabCount: Record<Tab, number> = { review: counts.proof_sent ?? 0, confirmed: counts.confirmed ?? 0, all: allRows.length }
  const rows = allRows.filter(
    ({ registration: r }) =>
      (tab === "all" || (tab === "review" ? r.status === "proof_sent" : r.status === "confirmed")) && matches(r, q),
  )
  const base = `/${lang}/dashboard/events/${event.id}/guests`
  const href = (extra: Record<string, string>) => {
    const sp = new URLSearchParams({ tab, ...(q ? { q } : {}), ...extra })
    return `${base}?${sp}`
  }
  const openId = typeof query.open === "string" ? query.open : null
  const opened = openId ? allRows.find((r) => r.registration.id === openId && r.receiptId) : undefined
  const keep = { tab, ...(q ? { q } : {}) }
  const taken = (counts.held ?? 0) + (counts.proof_sent ?? 0) + (counts.confirmed ?? 0)
  const autoCheck = organizer.autoCheck && event.priceUzs > 0
  const firstReview = allRows.find(({ registration: r, receiptId }) => r.status === "proof_sent" && receiptId)?.registration.id

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
      <input type="hidden" name="tab" value={tab} />
      {q && <input type="hidden" name="q" value={q} />}
      <Button type="submit" size="sm">
        <Check />
        {t.approve}
      </Button>
    </form>
  )
  const rejectDialog = (r: Registration) => (
    <ConfirmAction
      action={decideRegistrationAction}
      fields={{ lang, eventId: event.id, registrationId: r.id, decision: "rejected", ...keep }}
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
  const receiptButton = (registrationId: string, receiptId: string | null) =>
    receiptId ? (
      <Button variant="outline" size="sm" asChild>
        <Link href={href({ open: registrationId })} scroll={false}>
          <ImageIcon />
          {t.openReceipt}
        </Link>
      </Button>
    ) : null

  return (
    <EventManageShell lang={lang} dict={dict} event={event} organizer={organizer} tab="guests" review={counts.proof_sent ?? 0}>
      <section aria-labelledby="glance" className="flex flex-col gap-3">
        <h2 id="glance" className="text-lg font-semibold">
          {dict.manage.glance}
        </h2>
        <p>
          <span className="text-3xl font-semibold tabular-nums">{taken}</span>{" "}
          <span className="text-sm text-muted-foreground">{fmt(dict.manage.goingOf, { capacity: event.capacity })}</span>
        </p>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="bg-primary" style={{ width: `${(100 * (counts.confirmed ?? 0)) / event.capacity}%` }} />
          <span className="bg-muted-foreground" style={{ width: `${(100 * (counts.proof_sent ?? 0)) / event.capacity}%` }} />
          <span className="bg-muted-foreground/40" style={{ width: `${(100 * (counts.held ?? 0)) / event.capacity}%` }} />
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-primary" />
            {fmt(dict.manage.legendConfirmed, { n: counts.confirmed ?? 0 })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-muted-foreground" />
            {fmt(dict.manage.legendReview, { n: counts.proof_sent ?? 0 })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-muted-foreground/40" />
            {fmt(dict.manage.legendHeld, { n: counts.held ?? 0 })}
          </span>
          <span>{fmt(dict.manage.legendWaitlist, { n: counts.waitlist ?? 0 })}</span>
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: ReceiptText,
            title: t.tabs.review,
            hint: firstReview ? fmt(dict.manage.reviewHint, { n: counts.proof_sent ?? 0 }) : dict.manage.nothingToReview,
            href: firstReview ? `${base}?${new URLSearchParams({ tab: "review", open: firstReview })}` : null,
          },
          { icon: ScanLine, title: dict.manage.checkIn, hint: dict.manage.checkInHint, href: `/${lang}/dashboard/events/${event.id}/scan` },
          { icon: Download, title: t.export, hint: dict.manage.exportHint, href: allRows.length > 0 ? `/api/events/${event.id}/export?lang=${lang}` : null, download: true },
        ].map(({ icon: Icon, title, hint, href, download }) => {
          const body = (
            <Card className={`h-full flex-row items-center gap-3 px-4 py-4 ${href ? "transition-colors hover:bg-accent/40" : "opacity-60"}`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{title}</span>
                <span className="text-sm text-muted-foreground">{hint}</span>
              </span>
            </Card>
          )
          if (!href) return <div key={title}>{body}</div>
          return download ? (
            <a key={title} href={href} download className="rounded-xl">
              {body}
            </a>
          ) : (
            <Link key={title} href={href} scroll={false} className="rounded-xl">
              {body}
            </Link>
          )
        })}
      </div>

      <Card className="gap-4">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <CardTitle>{dict.manage.guestList}</CardTitle>
          </div>
          {allRows.length === 0 ? (
            <CardDescription>{t.empty}</CardDescription>
          ) : (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={tab}>
                <TabsList>
                  {TABS.map((key) => (
                    <TabsTrigger key={key} value={key} asChild>
                      <Link href={`${base}?${new URLSearchParams({ tab: key, ...(q ? { q } : {}) })}`} replace scroll={false}>
                        {t.tabs[key]}
                        <span className="tabular-nums text-muted-foreground">{tabCount[key]}</span>
                      </Link>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <form action={base} className="flex gap-2 sm:w-80">
                <input type="hidden" name="tab" value={tab} />
                <Input name="q" type="search" defaultValue={q} placeholder={t.search} aria-label={t.search} />
                <Button type="submit" variant="outline" size="icon" aria-label={t.searchButton}>
                  <Search />
                </Button>
              </form>
            </div>
          )}
          {allRows.length > 0 && rows.length === 0 && <CardDescription>{t.noMatches}</CardDescription>}
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
                      {receiptButton(r.id, receiptId)}
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
                      <TableCell>{receiptButton(r.id, receiptId) ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
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
      {opened?.receiptId && (
        <ReceiptReview
          key={opened.registration.id}
          lang={lang}
          eventId={event.id}
          registration={opened.registration}
          receiptId={opened.receiptId}
          expected={`${formatMoney(event.priceUzs, lang)} ${dict.public.uzs}`}
          check={autoCheck && opened.receipt?.verdict ? checkCell(opened.receipt) : undefined}
          pending={opened.registration.status === "proof_sent" || opened.registration.status === "held"}
          closeHref={href({})}
          tab={tab}
          q={q}
          dict={dict}
        />
      )}
    </EventManageShell>
  )
}

export default function Page(props: PageProps<"/[lang]/dashboard/events/[id]/guests">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
