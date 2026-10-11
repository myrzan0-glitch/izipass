"use client"

import { useActionState } from "react"

import type { ActionState } from "@/app/[lang]/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  lang: Locale
  eventId: string
  slug: string
  /** "izipass.myrzan.com/o/club/" shown before the input. */
  prefix: string
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

/** More → Event link: the last part of the event's address. */
export function EventSlugForm({ lang, eventId, slug, prefix, action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const error = state?.errors?.slug ? (dict.errors[state.errors.slug as keyof Dictionary["errors"]] ?? dict.errors.generic) : undefined
  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="eventId" value={eventId} />
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="slug" className="sr-only">
          {dict.manage.linkTitle}
        </FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-mono text-xs text-muted-foreground">{prefix}</span>
          <Input
            id="slug"
            name="slug"
            defaultValue={state?.values?.slug ?? slug}
            maxLength={48}
            aria-invalid={!!error}
            className="w-full font-mono sm:w-56"
          />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? dict.common.saving : dict.common.save}
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  )
}
