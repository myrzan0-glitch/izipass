"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { ActionState } from "@/app/[lang]/actions"
import type { Organizer } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { SITE_URL } from "@/lib/site"
import { slugify } from "@/lib/slug"

type Props = {
  lang: Locale
  organizer: Organizer | null
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  /** Logo and cover pickers, shown on the left (existing organizations only). */
  aside?: React.ReactNode
  dict: Dictionary
}

export function OrganizerForm({ lang, organizer, action, aside, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const v = (key: string, fallback = "") => state?.values?.[key] ?? fallback
  const err = (key: string) => (state?.errors?.[key] ? dict.errors[state.errors[key] as keyof Dictionary["errors"]] : undefined)
  const t = dict.organizer

  const [slug, setSlug] = useState(v("slug", organizer?.slug ?? ""))
  const [slugTouched, setSlugTouched] = useState(!!organizer)

  const host = SITE_URL.replace(/^https?:\/\//, "")
  return (
    <form action={formAction} noValidate className={aside ? "grid gap-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start" : undefined}>
      <input type="hidden" name="lang" value={lang} />
      {organizer && <input type="hidden" name="organizerId" value={organizer.id} />}
      {aside && <div className="flex flex-col gap-6 md:sticky md:top-20">{aside}</div>}
      <FieldGroup className="gap-6">
        <Field data-invalid={!!err("name")}>
          <FieldLabel htmlFor="name" className="sr-only">
            {t.name}
          </FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={v("name", organizer?.name ?? "")}
            placeholder={dict.orgs.namePlaceholder}
            maxLength={60}
            aria-invalid={!!err("name")}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
            className="h-auto rounded-none border-0 bg-transparent px-0 py-1 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-4xl dark:bg-transparent"
            required
          />
          {err("name") && <FieldError>{err("name")}</FieldError>}
        </Field>

        <Card className="gap-0 py-0">
          <div className="grid gap-2 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-4">
            <FieldLabel htmlFor="slug" className="text-muted-foreground">
              {t.slug}
            </FieldLabel>
            <Field data-invalid={!!err("slug")}>
              <div className="flex items-center gap-2">
                <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                  {host}/{lang}/o/
                </span>
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
                  className="font-mono"
                  required
                />
              </div>
              {err("slug") && <FieldError>{err("slug")}</FieldError>}
            </Field>
          </div>
          <Separator />
          <div className="grid gap-2 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-4">
            <FieldLabel htmlFor="links" className="text-muted-foreground sm:pt-2">
              {t.links}
            </FieldLabel>
            <Field data-invalid={!!err("links")}>
              <Textarea
                id="links"
                name="links"
                rows={3}
                defaultValue={v("links", organizer?.links.join("\n") ?? "")}
                placeholder={"https://t.me/yourclub\nhttps://instagram.com/yourclub"}
              />
              {err("links") ? <FieldError>{err("links")}</FieldError> : <FieldDescription>{t.linksHint}</FieldDescription>}
            </Field>
          </div>
        </Card>

        <Field data-invalid={!!err("description")}>
          <FieldLabel htmlFor="description">{t.description}</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={v("description", organizer?.description ?? "")}
            placeholder={t.descriptionPlaceholder}
            maxLength={1000}
          />
          {err("description") && <FieldError>{err("description")}</FieldError>}
        </Field>

        {err("form") && <FieldError>{err("form")}</FieldError>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? dict.common.saving : organizer ? dict.create.saveChanges : t.create}
        </Button>
      </FieldGroup>
    </form>
  )
}
