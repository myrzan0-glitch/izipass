"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { ActionState } from "@/app/[lang]/actions"
import { AUTO_CHECK_PRICE_UZS, type Organizer } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { formatMoney } from "@/lib/time"

type Props = {
  lang: Locale
  organizer: Organizer
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

/** Organizer settings → Payments: the auto-check add-on and the payout card it matches against. */
export function PaymentSettingsForm({ lang, organizer, action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const v = (key: string, fallback = "") => state?.values?.[key] ?? fallback
  const err = (key: string) => (state?.errors?.[key] ? dict.errors[state.errors[key] as keyof Dictionary["errors"]] : undefined)
  const t = dict.organizer
  // Controlled, with a key on each switch: Radix resets a switch to its mount-time value on form reset,
  // and React resets the form after every action.
  const [autoCheck, setAutoCheck] = useState(state?.values ? v("autoCheck") === "on" : organizer.autoCheck)
  const [autoApprove, setAutoApprove] = useState(state?.values ? v("autoApprove") === "on" : organizer.autoApprove)

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="organizerId" value={organizer.id} />
      <FieldSet>
        <FieldLegend>{t.autoCheckTitle}</FieldLegend>
        <FieldDescription>{fmt(t.autoCheckBody, { price: formatMoney(AUTO_CHECK_PRICE_UZS, lang) })}</FieldDescription>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="autoCheck">{t.autoCheck}</FieldLabel>
            </FieldContent>
            <Switch key={String(autoCheck)} id="autoCheck" name="autoCheck" checked={autoCheck} onCheckedChange={setAutoCheck} />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="autoApprove">{t.autoApprove}</FieldLabel>
              <FieldDescription>{t.autoApproveHint}</FieldDescription>
            </FieldContent>
            <Switch key={String(autoApprove)} id="autoApprove" name="autoApprove" checked={autoApprove} onCheckedChange={setAutoApprove} />
          </Field>
          <Field data-invalid={!!err("payoutCardLast4")}>
            <FieldLabel htmlFor="payoutCardLast4">{t.payoutCardLast4}</FieldLabel>
            <Input
              id="payoutCardLast4"
              name="payoutCardLast4"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              className="w-28"
              defaultValue={v("payoutCardLast4", organizer.payoutCardLast4 ?? "")}
              placeholder="1234"
              aria-invalid={!!err("payoutCardLast4")}
            />
            <FieldDescription>{t.payoutCardHint}</FieldDescription>
            {err("payoutCardLast4") && <FieldError>{err("payoutCardLast4")}</FieldError>}
          </Field>
          <Field data-invalid={!!err("payoutName")}>
            <FieldLabel htmlFor="payoutName">{t.payoutName}</FieldLabel>
            <Input
              id="payoutName"
              name="payoutName"
              maxLength={60}
              defaultValue={v("payoutName", organizer.payoutName ?? "")}
              placeholder="AZIZA K."
              aria-invalid={!!err("payoutName")}
            />
            <FieldDescription>{t.payoutNameHint}</FieldDescription>
            {err("payoutName") && <FieldError>{err("payoutName")}</FieldError>}
          </Field>
          <Field orientation="horizontal">
            <Button type="submit" disabled={pending}>
              {pending ? dict.common.saving : dict.common.save}
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}
