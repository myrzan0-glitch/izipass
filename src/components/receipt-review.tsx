"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"

import { decideRegistrationAction } from "@/app/[lang]/dashboard/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

type Props = {
  lang: Locale
  eventId: string
  registration: { id: string; name: string; phone: string; referenceCode: string }
  receiptId: string
  expected: string
  /** Auto-check result, rendered by the page. */
  check?: React.ReactNode
  /** Approve / Reject are offered while the receipt waits for a decision. */
  pending: boolean
  /** Where closing goes: the same list without the open receipt. */
  closeHref: string
  /** Current tab and search, kept after a decision. */
  tab: string
  q: string
  dict: Dictionary
}

/**
 * The receipt, big, with Approve / Reject next to it. Opened by ?open=<id>;
 * after a decision the page opens the next receipt waiting for review.
 */
export function ReceiptReview({ lang, eventId, registration, receiptId, expected, check, pending, closeHref, tab, q, dict }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const reasonId = useId()
  const t = dict.registrations
  const close = () => {
    setOpen(false)
    router.replace(closeHref, { scroll: false })
  }
  const hidden = (decision: "confirmed" | "rejected") => (
    <>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="registrationId" value={registration.id} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="reviewNext" value="1" />
      {tab && <input type="hidden" name="tab" value={tab} />}
      {q && <input type="hidden" name="q" value={q} />}
    </>
  )

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="flex max-h-[95svh] flex-col gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fmt(t.receiptTitle, { name: registration.name })}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-3">
            <span>{registration.phone}</span>
            <span className="font-mono">{registration.referenceCode}</span>
            <span>
              {t.expected}: <span className="font-medium text-foreground">{expected}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request image */}
          <img src={`/api/receipts/${receiptId}`} alt={t.receipt} className="mx-auto max-h-[55svh] w-auto object-contain" />
        </div>
        {check}

        {pending && rejecting ? (
          <form action={decideRegistrationAction} onSubmit={() => setOpen(false)} className="flex flex-col gap-3">
            {hidden("rejected")}
            <Field>
              <FieldLabel htmlFor={reasonId}>{dict.confirm.rejectReason}</FieldLabel>
              <Textarea id={reasonId} name="reason" placeholder={dict.confirm.rejectReasonPlaceholder} maxLength={200} rows={2} autoFocus />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejecting(false)}>
                {dict.confirm.keep}
              </Button>
              <Button type="submit" variant="destructive">
                <X />
                {dict.confirm.rejectConfirm}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter>
            {pending ? (
              <>
                <Button type="button" variant="outline" onClick={() => setRejecting(true)}>
                  <X />
                  {t.reject}
                </Button>
                <form action={decideRegistrationAction} onSubmit={() => setOpen(false)}>
                  {hidden("confirmed")}
                  <Button type="submit" className="w-full">
                    <Check />
                    {t.approve}
                  </Button>
                </form>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={close}>
                {t.close}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
