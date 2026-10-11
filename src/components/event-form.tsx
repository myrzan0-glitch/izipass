"use client"

import { useActionState, useState } from "react"
import { Clock, MapPin } from "lucide-react"

import { CoverPicker } from "@/components/cover-picker"
import { OrgMark } from "@/components/org-mark"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { ActionState } from "@/app/[lang]/actions"
import type { Event } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { slugify } from "@/lib/slug"
import { toLocalInput } from "@/lib/time"
import { CLOSES_BEFORE_MINUTES, HOLD_MINUTES } from "@/lib/validation"

export type OrgOption = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  maxCapacity: number
  /** Where the organization's last paid event took payments, to fill in a new one. */
  payment?: { paymentTo: string; paymentInstructions: string }
}

type Props = {
  lang: Locale
  event: Event | null
  /**
   * all: Create event. details: Edit event (name, time, place, description).
   * registration: the Registration tab (price, spots, payment, deadline).
   */
  section: "all" | "details" | "registration"
  /** Organizations to create the event in; empty for a first event (a name is asked instead). */
  organizers: OrgOption[]
  defaultOrganizerId?: string
  /** Spots allowed for a new organization (free plan). */
  newOrgMaxCapacity: number
  /** The tab a save returns to. */
  returnTo?: "registration"
  /** Shown in the Payment card of the Registration tab (auto-check status). */
  paymentExtra?: React.ReactNode
  action: (prev: ActionState, form: FormData) => Promise<ActionState>
  dict: Dictionary
}

/** "50000" → "50 000" while typing; the server keeps only the digits. */
function groupDigits(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

/** A labelled line inside a card: label on the left, control on the right (stacked on phones). */
function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-4">
      <FieldLabel htmlFor={htmlFor} className="text-muted-foreground">
        {label}
      </FieldLabel>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * The event form, laid out like the event page: cover on the left, the
 * name big on top, then time, place, description and the ticket options.
 * Fields a section doesn't show are sent as they are.
 */
export function EventForm({ lang, event, section, organizers, defaultOrganizerId, newOrgMaxCapacity, returnTo, paymentExtra, action, dict }: Props) {
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
  const c = dict.create

  const [organizerId, setOrganizerId] = useState(v("organizerId", event?.organizerId ?? defaultOrganizerId ?? organizers[0]?.id ?? ""))
  const organizer = organizers.find((o) => o.id === organizerId)
  const maxCapacity = organizer?.maxCapacity ?? newOrgMaxCapacity
  const [slug, setSlug] = useState(v("slug", event?.slug ?? ""))
  const [slugTouched, setSlugTouched] = useState(!!event)
  const [slugOpen, setSlugOpen] = useState(!!err("slug"))
  const startPrice = Number(v("priceUzs", String(event?.priceUzs ?? 0)).replace(/\D/g, "") || 0)
  // Free or Paid is picked first; Paid shows the price and where to pay.
  const [paid, setPaid] = useState(startPrice > 0 || v("paid") === "1")
  const [price, setPrice] = useState(startPrice > 0 ? groupDigits(String(startPrice)) : "")
  const priceValue = paid ? 1 : 0

  const showDetails = section !== "registration"
  const showOptions = section !== "details"

  // Values of the fields this section doesn't show.
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />
  const detailsHidden = event && !showDetails && (
    <>
      {hidden("title", event.title)}
      {hidden("slug", event.slug)}
      {hidden("startsAt", toLocalInput(event.startsAt))}
      {hidden("endsAt", event.endsAt ? toLocalInput(event.endsAt) : "")}
      {hidden("venue", event.venue)}
      {hidden("venueUrl", event.venueUrl ?? "")}
      {hidden("description", event.description)}
    </>
  )
  const optionsHidden = event && !showOptions && (
    <>
      {hidden("capacity", String(event.capacity))}
      {hidden("priceUzs", String(event.priceUzs))}
      {hidden("paymentTo", event.paymentTo)}
      {hidden("paymentInstructions", event.paymentInstructions)}
      {hidden("holdMinutes", String(event.holdMinutes))}
      {hidden("registrationClosesBefore", String(event.registrationClosesBefore))}
    </>
  )

  const capacityField = (
    <Field data-invalid={!!err("capacity")}>
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
      {err("capacity") ? <FieldError>{err("capacity")}</FieldError> : <FieldDescription>{fmt(t.capacityHint, { n: maxCapacity })}</FieldDescription>}
    </Field>
  )
  const priceField = (
    <Field data-invalid={!!err("priceUzs")}>
      <Tabs value={paid ? "paid" : "free"} onValueChange={(value) => setPaid(value === "paid")}>
        <TabsList className="w-full sm:w-60">
          <TabsTrigger value="free">{c.free}</TabsTrigger>
          <TabsTrigger value="paid">{c.paid}</TabsTrigger>
        </TabsList>
      </Tabs>
      {paid ? (
        <>
          {hidden("paid", "1")}
          <div className="relative">
            <Input
              id="priceUzs"
              name="priceUzs"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="50 000"
              value={price}
              onChange={(e) => setPrice(groupDigits(e.target.value))}
              aria-invalid={!!err("priceUzs")}
              aria-label={c.ticketPrice}
              className="pr-14"
              autoFocus={startPrice === 0}
              required
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{dict.public.uzs}</span>
          </div>
        </>
      ) : (
        hidden("priceUzs", "0")
      )}
      {err("priceUzs") && <FieldError>{err("priceUzs")}</FieldError>}
    </Field>
  )
  // A new event starts with the organization's last payment details; switching organization swaps them.
  const paymentDefaults = event ?? organizer?.payment ?? { paymentTo: "", paymentInstructions: "" }
  const paymentToField = (
    <Field data-invalid={!!err("paymentTo")} key={`to-${organizerId}`}>
      <Input
        id="paymentTo"
        name="paymentTo"
        defaultValue={v("paymentTo", paymentDefaults.paymentTo)}
        placeholder={t.paymentToPlaceholder}
        maxLength={200}
        autoComplete="off"
        aria-invalid={!!err("paymentTo")}
      />
      {err("paymentTo") ? <FieldError>{err("paymentTo")}</FieldError> : <FieldDescription>{t.paymentToHint}</FieldDescription>}
    </Field>
  )
  const paymentField = (
    <Field data-invalid={!!err("paymentInstructions")} key={`note-${organizerId}`}>
      <Textarea
        id="paymentInstructions"
        name="paymentInstructions"
        rows={2}
        defaultValue={v("paymentInstructions", paymentDefaults.paymentInstructions)}
        placeholder={t.paymentInstructionsPlaceholder}
        maxLength={1000}
        aria-invalid={!!err("paymentInstructions")}
      />
      {err("paymentInstructions") && <FieldError>{err("paymentInstructions")}</FieldError>}
    </Field>
  )
  const holdField = (
    <Field data-invalid={!!err("holdMinutes")}>
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
    </Field>
  )
  const closesField = (
    <Field data-invalid={!!err("registrationClosesBefore")}>
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
    </Field>
  )
  // A free event still sends the hold time, so the form stays valid.
  const holdHidden = priceValue <= 0 && hidden("holdMinutes", v("holdMinutes", String(event?.holdMinutes ?? 30)))

  const submit = (
    <>
      {err("form") && <FieldError>{err("form")}</FieldError>}
      <Button type="submit" size="lg" disabled={pending} className={section === "registration" ? "self-end" : "w-full"}>
        {pending ? dict.common.saving : event ? c.saveChanges : t.create}
      </Button>
    </>
  )

  if (section === "registration") {
    return (
      <form action={formAction} noValidate className="flex flex-col gap-6">
        {hidden("lang", lang)}
        {event && hidden("eventId", event.id)}
        {returnTo && hidden("returnTo", returnTo)}
        {detailsHidden}
        <Card>
          <CardHeader>
            <CardTitle>{dict.manage.ticketsTitle}</CardTitle>
            <CardDescription>{dict.manage.ticketsHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <FieldLabel htmlFor="priceUzs">{c.ticketPrice}</FieldLabel>
                {priceField}
              </div>
              <div className="flex flex-col gap-3">
                <FieldLabel htmlFor="capacity">{t.capacity}</FieldLabel>
                {capacityField}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
        {priceValue > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{dict.manage.paymentTitle}</CardTitle>
              <CardDescription>{dict.manage.paymentHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="flex flex-col gap-3">
                  <FieldLabel htmlFor="paymentTo">{t.paymentTo}</FieldLabel>
                  {paymentToField}
                </div>
                <div className="flex flex-col gap-3">
                  <FieldLabel htmlFor="paymentInstructions">{t.paymentInstructions}</FieldLabel>
                  {paymentField}
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <FieldLabel htmlFor="holdMinutes">{t.holdMinutes}</FieldLabel>
                    {holdField}
                  </div>
                  {paymentExtra}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        )}
        {priceValue <= 0 && hidden("paymentTo", v("paymentTo", event?.paymentTo ?? ""))}
        {priceValue <= 0 && hidden("paymentInstructions", v("paymentInstructions", event?.paymentInstructions ?? ""))}
        {holdHidden}
        <Card>
          <CardHeader>
            <CardTitle>{dict.manage.windowTitle}</CardTitle>
            <CardDescription>{dict.manage.waitlistNote}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <FieldLabel htmlFor="registrationClosesBefore">{t.closesBefore}</FieldLabel>
            {closesField}
          </CardContent>
        </Card>
        {submit}
      </form>
    )
  }

  return (
    <form action={formAction} noValidate className="grid gap-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-start">
      {hidden("lang", lang)}
      {event && hidden("eventId", event.id)}
      {optionsHidden}

      <div className="md:sticky md:top-20">
        <CoverPicker endpoint={event ? `/api/events/${event.id}/cover` : null} url={event?.coverUrl ?? null} dict={dict} />
      </div>

      <FieldGroup className="gap-6">
        {!event &&
          (organizers.length > 0 ? (
            <Field className="w-fit">
              <FieldLabel htmlFor="organizerId" className="sr-only">
                {c.organization}
              </FieldLabel>
              <Select name="organizerId" value={organizerId} onValueChange={setOrganizerId}>
                <SelectTrigger id="organizerId" size="sm" className="border-0 bg-secondary shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <OrgMark name={o.name} logoUrl={o.logoUrl} className="size-4" />
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field data-invalid={!!err("organizerName")}>
              <FieldLabel htmlFor="organizerName">{c.newOrganization}</FieldLabel>
              <Input
                id="organizerName"
                name="organizerName"
                defaultValue={v("organizerName")}
                placeholder={c.newOrganizationPlaceholder}
                maxLength={60}
                aria-invalid={!!err("organizerName")}
              />
              {err("organizerName") ? <FieldError>{err("organizerName")}</FieldError> : <FieldDescription>{c.newOrganizationHint}</FieldDescription>}
            </Field>
          ))}

        <Field data-invalid={!!err("title")}>
          <FieldLabel htmlFor="title" className="sr-only">
            {t.title}
          </FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={v("title", event?.title ?? "")}
            placeholder={c.namePlaceholder}
            maxLength={80}
            aria-invalid={!!err("title")}
            onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
            className="h-auto rounded-none border-0 bg-transparent px-0 py-1 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-4xl dark:bg-transparent"
            required
          />
          {err("title") && <FieldError>{err("title")}</FieldError>}
        </Field>

        <Card className="gap-0 py-0">
          <Row label={c.start} htmlFor="startsAt">
            <Field data-invalid={!!err("startsAt")}>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={v("startsAt", event ? toLocalInput(event.startsAt) : "")}
                aria-invalid={!!err("startsAt")}
                required
              />
              {err("startsAt") && <FieldError>{err("startsAt")}</FieldError>}
            </Field>
          </Row>
          <Separator />
          <Row label={c.end} htmlFor="endsAt">
            <Field data-invalid={!!err("endsAt")}>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={v("endsAt", event?.endsAt ? toLocalInput(event.endsAt) : "")}
                aria-invalid={!!err("endsAt")}
              />
              {err("endsAt") && <FieldError>{err("endsAt")}</FieldError>}
            </Field>
          </Row>
          <Separator />
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {c.timeZone}
          </p>
        </Card>

        <Card className="gap-0 py-0">
          <Row label={c.location} htmlFor="venue">
            <Field data-invalid={!!err("venue")}>
              <Input id="venue" name="venue" defaultValue={v("venue", event?.venue ?? "")} placeholder={t.venuePlaceholder} maxLength={160} />
              {err("venue") && <FieldError>{err("venue")}</FieldError>}
            </Field>
          </Row>
          <Separator />
          <Row label={c.mapLink} htmlFor="venueUrl">
            <Field data-invalid={!!err("venueUrl")}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="venueUrl"
                  name="venueUrl"
                  type="url"
                  inputMode="url"
                  defaultValue={v("venueUrl", event?.venueUrl ?? "")}
                  placeholder="https://maps.app.goo.gl/…"
                  aria-invalid={!!err("venueUrl")}
                  className="pl-9"
                />
              </div>
              {err("venueUrl") && <FieldError>{err("venueUrl")}</FieldError>}
            </Field>
          </Row>
        </Card>

        <Field data-invalid={!!err("description")}>
          <FieldLabel htmlFor="description">{c.description}</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={v("description", event?.description ?? "")}
            placeholder={t.descriptionPlaceholder}
            maxLength={4000}
          />
          {err("description") && <FieldError>{err("description")}</FieldError>}
        </Field>

        {showOptions && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">{c.options}</h2>
            <Card className="gap-0 py-0">
              <Row label={c.ticketPrice} htmlFor="priceUzs">
                {priceField}
              </Row>
              {priceValue > 0 && (
                <>
                  <Separator />
                  <Row label={t.paymentTo} htmlFor="paymentTo">
                    {paymentToField}
                  </Row>
                  <Separator />
                  <Row label={t.paymentInstructions} htmlFor="paymentInstructions">
                    {paymentField}
                  </Row>
                </>
              )}
              <Separator />
              <Row label={t.capacity} htmlFor="capacity">
                {capacityField}
              </Row>
              <Separator />
              <Row label={t.closesBefore} htmlFor="registrationClosesBefore">
                {closesField}
              </Row>
              {priceValue > 0 && (
                <>
                  <Separator />
                  <Row label={t.holdMinutes} htmlFor="holdMinutes">
                    {holdField}
                  </Row>
                </>
              )}
            </Card>
            {priceValue <= 0 && hidden("paymentTo", "")}
            {priceValue <= 0 && hidden("paymentInstructions", "")}
            {holdHidden}
          </div>
        )}

        {section === "all" ? (
          <Collapsible open={slugOpen} onOpenChange={setSlugOpen}>
            <Field data-invalid={!!err("slug")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <FieldLabel htmlFor="slug" className="text-muted-foreground">
                  {t.link}
                </FieldLabel>
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                  /o/{organizer?.slug ?? "…"}/{slug || "…"}
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
              {!slugOpen && hidden("slug", slug)}
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
        ) : (
          event && hidden("slug", event.slug)
        )}

        {submit}
      </FieldGroup>
    </form>
  )
}
