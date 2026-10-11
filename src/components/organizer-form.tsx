"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ActionState } from "@/app/[lang]/dashboard/actions"
import type { Organizer } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { SITE_URL } from "@/lib/site"
import { slugify } from "@/lib/slug"

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

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      {organizer && <input type="hidden" name="organizerId" value={organizer.id} />}
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
