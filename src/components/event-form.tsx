"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ActionState } from "@/app/[lang]/dashboard/actions"
import type { Event } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { slugify } from "@/lib/slug"
import { toLocalInput } from "@/lib/time"
import { CLOSES_BEFORE_MINUTES, HOLD_MINUTES } from "@/lib/validation"

type Props = {
  lang: Locale
  event: Event | null
  organizerSlug: string
  maxCapacity: number
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

/** "50000" → "50 000" while typing; the server keeps only the digits. */
function groupDigits(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export function EventForm({ lang, event, organizerSlug, maxCapacity, action, dict }: Props) {
  const [state, formAction, pending] = useActionState(action, null)
  const v = (key: string, fallback = "") => state?.values?.[key] ?? fallback
  const err = (key: string) => {
    const raw = state?.errors?.[key]
    if (!raw) return undefined
    const [code, n] = raw.split(":")
    const text = dict.errors[code as keyof Dictionary["errors"]] ?? dict.errors.generic
    return fmt(text, { n: code === "participantsPerEvent" ? maxCapacity : (n ?? "") })
  }
  const t = dict.event

  const [slug, setSlug] = useState(v("slug", event?.slug ?? ""))
  const [slugTouched, setSlugTouched] = useState(!!event)
  const [price, setPrice] = useState(groupDigits(v("priceUzs", String(event?.priceUzs ?? 0))))
  const priceValue = Number(price.replace(/\D/g, "") || 0)
  // The address is generated from the title; it opens for editing only on request or on an error.
  const [slugOpen, setSlugOpen] = useState(!!err("slug"))

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="lang" value={lang} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <FieldGroup>
        <Field data-invalid={!!err("title")}>
          <FieldLabel htmlFor="title">{t.title}</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={v("title", event?.title ?? "")}
            placeholder={t.titlePlaceholder}
            maxLength={80}
            aria-invalid={!!err("title")}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
            required
          />
          {err("title") && <FieldError>{err("title")}</FieldError>}
        </Field>

        <Collapsible open={slugOpen} onOpenChange={setSlugOpen}>
          <Field data-invalid={!!err("slug")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <FieldLabel htmlFor="slug" className="text-muted-foreground">
                {t.link}
              </FieldLabel>
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                /{lang}/o/{organizerSlug}/{slug || "…"}
              </span>
              {!slugOpen && (
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="link" size="sm" className="h-auto px-0">
                    {t.changeLink}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
            {/* Always submitted; the input is only shown when opened. */}
            {!slugOpen && <input type="hidden" name="slug" value={slug} />}
            <CollapsibleContent>
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
            </CollapsibleContent>
            {err("slug") && <FieldError>{err("slug")}</FieldError>}
          </Field>
        </Collapsible>

        <FieldSet>
          <FieldLegend>{t.sectionWhen}</FieldLegend>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field data-invalid={!!err("startsAt")}>
              <FieldLabel htmlFor="startsAt">{t.startsAt}</FieldLabel>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={v("startsAt", event ? toLocalInput(event.startsAt) : "")}
                aria-invalid={!!err("startsAt")}
                required
              />
              <FieldDescription>{t.timeZoneHint}</FieldDescription>
              {err("startsAt") && <FieldError>{err("startsAt")}</FieldError>}
            </Field>
            <Field data-invalid={!!err("endsAt")}>
              <FieldLabel htmlFor="endsAt">{t.endsAt}</FieldLabel>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={v("endsAt", event?.endsAt ? toLocalInput(event.endsAt) : "")}
                aria-invalid={!!err("endsAt")}
              />
              {err("endsAt") && <FieldError>{err("endsAt")}</FieldError>}
            </Field>
          </div>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t.sectionPlace}</FieldLegend>
          <FieldGroup>
            <Field data-invalid={!!err("venue")}>
              <FieldLabel htmlFor="venue">{t.venue}</FieldLabel>
              <Input
                id="venue"
                name="venue"
                defaultValue={v("venue", event?.venue ?? "")}
                placeholder={t.venuePlaceholder}
                maxLength={160}
              />
              {err("venue") && <FieldError>{err("venue")}</FieldError>}
            </Field>

            <Field data-invalid={!!err("venueUrl")}>
              <FieldLabel htmlFor="venueUrl">{t.venueUrl}</FieldLabel>
              <Input
                id="venueUrl"
                name="venueUrl"
                type="url"
                inputMode="url"
                defaultValue={v("venueUrl", event?.venueUrl ?? "")}
                placeholder="https://maps.app.goo.gl/…"
                aria-invalid={!!err("venueUrl")}
              />
              {err("venueUrl") && <FieldError>{err("venueUrl")}</FieldError>}
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t.sectionAbout}</FieldLegend>

          <Field data-invalid={!!err("description")}>
            <FieldLabel htmlFor="description" className="sr-only">
              {t.description}
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              rows={6}
              defaultValue={v("description", event?.description ?? "")}
              placeholder={t.descriptionPlaceholder}
              maxLength={4000}
            />
            {err("description") && <FieldError>{err("description")}</FieldError>}
          </Field>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t.registration}</FieldLegend>
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!err("capacity")}>
                <FieldLabel htmlFor="capacity">{t.capacity}</FieldLabel>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxCapacity}
                  defaultValue={v("capacity", String(event?.capacity ?? Math.min(20, maxCapacity)))}
                  aria-invalid={!!err("capacity")}
                  required
                />
                <FieldDescription>{fmt(t.capacityHint, { n: maxCapacity })}</FieldDescription>
                {err("capacity") && <FieldError>{err("capacity")}</FieldError>}
              </Field>
              <Field data-invalid={!!err("priceUzs")}>
                <FieldLabel htmlFor="priceUzs">{t.price}</FieldLabel>
                <Input
                  id="priceUzs"
                  name="priceUzs"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={price}
                  onChange={(e) => setPrice(groupDigits(e.target.value))}
                  // Typing replaces the starting "0" instead of appending to it.
                  onFocus={(e) => e.currentTarget.select()}
                  aria-invalid={!!err("priceUzs")}
                  required
                />
                <FieldDescription>{t.priceHint}</FieldDescription>
                {err("priceUzs") && <FieldError>{err("priceUzs")}</FieldError>}
              </Field>
            </div>

            {priceValue > 0 && (
              <>
                <Field data-invalid={!!err("paymentInstructions")}>
                  <FieldLabel htmlFor="paymentInstructions">{t.paymentInstructions}</FieldLabel>
                  <Textarea
                    id="paymentInstructions"
                    name="paymentInstructions"
                    rows={3}
                    defaultValue={v("paymentInstructions", event?.paymentInstructions ?? "")}
                    placeholder={t.paymentInstructionsPlaceholder}
                    maxLength={1000}
                    aria-invalid={!!err("paymentInstructions")}
                  />
                  <FieldDescription>{t.paymentInstructionsHint}</FieldDescription>
                  {err("paymentInstructions") && <FieldError>{err("paymentInstructions")}</FieldError>}
                </Field>

                <Field data-invalid={!!err("holdMinutes")}>
                  <FieldLabel htmlFor="holdMinutes">{t.holdMinutes}</FieldLabel>
                  <Select name="holdMinutes" defaultValue={v("holdMinutes", String(event?.holdMinutes ?? 30))}>
                    <SelectTrigger id="holdMinutes" className="w-full sm:w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOLD_MINUTES.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {fmt(t.minutes, { n: m })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t.holdMinutesHint}</FieldDescription>
                  {err("holdMinutes") && <FieldError>{err("holdMinutes")}</FieldError>}
                </Field>
              </>
            )}
            {priceValue <= 0 && <input type="hidden" name="holdMinutes" value={String(event?.holdMinutes ?? 30)} />}

            <Field data-invalid={!!err("registrationClosesBefore")}>
              <FieldLabel htmlFor="registrationClosesBefore">{t.closesBefore}</FieldLabel>
              <Select name="registrationClosesBefore" defaultValue={v("registrationClosesBefore", String(event?.registrationClosesBefore ?? 0))}>
                <SelectTrigger id="registrationClosesBefore" className="w-full sm:w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLOSES_BEFORE_MINUTES.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {t.closesOptions[String(m) as keyof typeof t.closesOptions]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t.closesHint}</FieldDescription>
              {err("registrationClosesBefore") && <FieldError>{err("registrationClosesBefore")}</FieldError>}
            </Field>
          </FieldGroup>
        </FieldSet>

        {err("form") && <FieldError>{err("form")}</FieldError>}

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending ? dict.common.saving : event ? dict.common.save : t.create}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
