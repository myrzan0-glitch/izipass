"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ActionState } from "@/app/[lang]/dashboard/actions"
import { AUTO_CHECK_PRICE_UZS, type Organizer } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { SITE_URL } from "@/lib/site"
import { slugify } from "@/lib/slug"
import { formatMoney } from "@/lib/time"

type Props = {
  lang: Locale
  organizer: Organizer | null
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

export function OrganizerForm({ lang, organizer, action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const v = (key: string, fallback = "") => state?.values?.[key] ?? fallback
  const err = (key: string) => (state?.errors?.[key] ? dict.errors[state.errors[key] as keyof Dictionary["errors"]] : undefined)
  const t = dict.organizer

  const [slug, setSlug] = useState(v("slug", organizer?.slug ?? ""))
  const [slugTouched, setSlugTouched] = useState(!!organizer)
  // Controlled: React resets uncontrolled fields after a server action, which would drop a toggle on a validation error.
  const [autoCheck, setAutoCheck] = useState(state?.values ? v("autoCheck") === "on" : (organizer?.autoCheck ?? false))
  const [autoApprove, setAutoApprove] = useState(state?.values ? v("autoApprove") === "on" : (organizer?.autoApprove ?? false))

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      <FieldGroup>
        <Field data-invalid={!!err("name")}>
          <FieldLabel htmlFor="name">{t.name}</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={v("name", organizer?.name ?? "")}
            placeholder={t.namePlaceholder}
            maxLength={60}
            aria-invalid={!!err("name")}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
            required
          />
          {err("name") && <FieldError>{err("name")}</FieldError>}
        </Field>

        <Field data-invalid={!!err("slug")}>
          <FieldLabel htmlFor="slug">{t.slug}</FieldLabel>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            maxLength={48}
            aria-invalid={!!err("slug")}
            required
          />
          <FieldDescription className="font-mono text-xs">
            {SITE_URL.replace(/^https?:\/\//, "")}/{lang}/o/{slug || "…"}
          </FieldDescription>
          {err("slug") && <FieldError>{err("slug")}</FieldError>}
        </Field>

        <Field data-invalid={!!err("description")}>
          <FieldLabel htmlFor="description">{t.description}</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={v("description", organizer?.description ?? "")}
            placeholder={t.descriptionPlaceholder}
            maxLength={1000}
          />
          {err("description") && <FieldError>{err("description")}</FieldError>}
        </Field>

        <Field data-invalid={!!err("links")}>
          <FieldLabel htmlFor="links">{t.links}</FieldLabel>
          <Textarea
            id="links"
            name="links"
            rows={3}
            defaultValue={v("links", organizer?.links.join("\n") ?? "")}
            placeholder={"https://t.me/yourclub\nhttps://instagram.com/yourclub"}
          />
          <FieldDescription>{t.linksHint}</FieldDescription>
          {err("links") && <FieldError>{err("links")}</FieldError>}
        </Field>

        {organizer && (
          <FieldSet>
            <FieldLegend>{t.autoCheckTitle}</FieldLegend>
            <FieldDescription>{fmt(t.autoCheckBody, { price: formatMoney(AUTO_CHECK_PRICE_UZS, lang) })}</FieldDescription>
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="autoCheck">{t.autoCheck}</FieldLabel>
                </FieldContent>
                {/* key: Radix resets a switch to its mount-time value on form reset (React does one after each action). */}
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
            </FieldGroup>
          </FieldSet>
        )}

        {err("form") && <FieldError>{err("form")}</FieldError>}

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? dict.common.saving : organizer ? dict.common.save : t.create}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
