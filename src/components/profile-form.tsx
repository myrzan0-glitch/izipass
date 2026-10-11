"use client"

import { useActionState } from "react"

import type { ActionState } from "@/app/[lang]/dashboard/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { User } from "@/lib/db/schema"
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  lang: Locale
  user: Pick<User, "name" | "phone" | "locale">
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

/** Settings → Your profile: name, phone and language. */
export function ProfileForm({ lang, user, action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const v = (key: string, fallback: string) => state?.values?.[key] ?? fallback
  const err = (key: string) => (state?.errors?.[key] ? dict.errors[state.errors[key] as keyof Dictionary["errors"]] : undefined)
  const t = dict.settings

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!err("name")}>
            <FieldLabel htmlFor="name">{t.name}</FieldLabel>
            <Input id="name" name="name" defaultValue={v("name", user.name)} maxLength={80} autoComplete="name" aria-invalid={!!err("name")} />
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
              defaultValue={v("phone", user.phone)}
              aria-invalid={!!err("phone")}
            />
            {err("phone") ? <FieldError>{err("phone")}</FieldError> : <FieldDescription>{t.phoneHint}</FieldDescription>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="locale">{t.language}</FieldLabel>
          <Select name="locale" defaultValue={v("locale", LOCALES.includes(user.locale as Locale) ? user.locale : lang)}>
            <SelectTrigger id="locale" className="w-full sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t.languageHint}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? dict.common.saving : dict.common.save}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
