"use client"

import { useActionState } from "react"

import type { ActionState } from "@/app/[lang]/dashboard/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  lang: Locale
  organizerSlug: string
  eventSlug: string
  defaults: { name: string }
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

export function RegisterForm({ lang, organizerSlug, eventSlug, defaults, action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const v = (key: string, fallback = "") => state?.values?.[key] ?? fallback
  const err = (key: string) => (state?.errors?.[key] ? (dict.errors[state.errors[key] as keyof Dictionary["errors"]] ?? dict.errors.generic) : undefined)
  const t = dict.register

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="organizer" value={organizerSlug} />
      <input type="hidden" name="event" value={eventSlug} />
      <FieldGroup>
        <Field data-invalid={!!err("name")}>
          <FieldLabel htmlFor="name">{t.name}</FieldLabel>
          <Input id="name" name="name" autoComplete="name" defaultValue={v("name", defaults.name)} maxLength={80} aria-invalid={!!err("name")} required />
          <FieldDescription>{t.nameHint}</FieldDescription>
          {err("name") && <FieldError>{err("name")}</FieldError>}
        </Field>
        <Field data-invalid={!!err("phone")}>
          <FieldLabel htmlFor="phone">{t.phone}</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            defaultValue={v("phone")}
            aria-invalid={!!err("phone")}
            required
          />
          <FieldDescription>{t.phoneHint}</FieldDescription>
          {err("phone") && <FieldError>{err("phone")}</FieldError>}
        </Field>
        <Field data-invalid={!!err("note")}>
          <FieldLabel htmlFor="note">{t.note}</FieldLabel>
          <Textarea id="note" name="note" rows={2} defaultValue={v("note")} maxLength={500} />
          {err("note") && <FieldError>{err("note")}</FieldError>}
        </Field>
        {err("form") && <FieldError>{err("form")}</FieldError>}
        <Field orientation="horizontal">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? dict.common.saving : t.submit}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
