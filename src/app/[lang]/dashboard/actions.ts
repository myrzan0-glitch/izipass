"use server"

import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { PlanLimitError, createEvent, duplicateEvent, getEvent, setEventStatus, updateEvent } from "@/lib/events"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { SlugTakenError, createOrganizer, getOrganizerForUser, updateOrganizer, updatePaymentSettings } from "@/lib/organizers"
import { RegistrationError, decide, nextToReview } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"
import { telegramApiFromEnv } from "@/lib/telegram/api"
import { connectWebhook } from "@/lib/telegram/webhook"
import { fromLocalInput } from "@/lib/time"
import { eventSchema, fieldErrors, organizerSchema, paymentSettingsSchema } from "@/lib/validation"
import { notifyLater } from "@/lib/telegram/notify"

/** Field → error key (under `errors` in the dictionary). `form` is a general error. */
export type ActionState = { errors?: Record<string, string>; values?: Record<string, string> } | null

const str = (form: FormData, key: string) => String(form.get(key) ?? "")
// Prices arrive formatted ("50 000", "50,000"): keep the digits.
const num = (form: FormData, key: string) => {
  const raw = str(form, key).replace(/[\s,'’]+/g, "")
  return raw === "" ? NaN : Number(raw)
}

function langOf(form: FormData) {
  const lang = str(form, "lang")
  return isLocale(lang) ? lang : DEFAULT_LOCALE
}

function values(form: FormData) {
  const out: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === "string" && k !== "lang") out[k] = v
  return out
}

async function currentUserId() {
  const session = await getSession()
  if (!session) throw new Error("unauthorized")
  return session.userId
}

function parseOrganizer(form: FormData) {
  const links = str(form, "links")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return organizerSchema.safeParse({
    slug: str(form, "slug"),
    name: str(form, "name"),
    description: str(form, "description"),
    links,
  })
}

export async function saveOrganizerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const userId = await currentUserId()
  const parsed = parseOrganizer(form)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }

  let existing
  try {
    existing = await getOrganizerForUser(db(), userId)
    if (existing) await updateOrganizer(db(), existing.id, parsed.data)
    else await createOrganizer(db(), userId, parsed.data)
  } catch (error) {
    if (error instanceof SlugTakenError) return { errors: { slug: "slugTaken" }, values: values(form) }
    throw error
  }
  redirect(existing ? `/${lang}/dashboard/organizer?saved=1` : `/${lang}/dashboard`)
}

/** Organizer settings → Payments: auto-check add-on and payout card details. */
export async function savePaymentSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const userId = await currentUserId()
  const organizer = await getOrganizerForUser(db(), userId)
  if (!organizer) redirect(`/${lang}/dashboard`)
  const parsed = paymentSettingsSchema.safeParse({
    autoCheck: str(form, "autoCheck") === "on",
    autoApprove: str(form, "autoApprove") === "on",
    payoutCardLast4: str(form, "payoutCardLast4"),
    payoutName: str(form, "payoutName"),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }
  await updatePaymentSettings(db(), organizer.id, parsed.data)
  redirect(`/${lang}/dashboard/organizer?tab=payments&saved=1`)
}

/** Copies an event as a draft a week later (weekly clubs). */
export async function duplicateEventAction(form: FormData) {
  const lang = langOf(form)
  const userId = await currentUserId()
  const organizer = await getOrganizerForUser(db(), userId)
  if (!organizer) redirect(`/${lang}/dashboard`)
  const eventId = str(form, "eventId")
  let copyId: string | null = null
  try {
    copyId = (await duplicateEvent(db(), organizer, eventId))?.id ?? null
  } catch (error) {
    if (error instanceof PlanLimitError) redirect(`/${lang}/dashboard/events/${eventId}?error=${error.limit}`)
    throw error
  }
  redirect(copyId ? `/${lang}/dashboard/events/${copyId}?duplicated=1` : `/${lang}/dashboard`)
}

function parseEvent(form: FormData) {
  const endsAt = str(form, "endsAt")
  return eventSchema.safeParse({
    slug: str(form, "slug"),
    title: str(form, "title"),
    description: str(form, "description"),
    startsAt: fromLocalInput(str(form, "startsAt")) ?? new Date(NaN),
    endsAt: endsAt ? fromLocalInput(endsAt) : null,
    venue: str(form, "venue"),
    venueUrl: str(form, "venueUrl"),
    capacity: num(form, "capacity"),
    priceUzs: num(form, "priceUzs"),
    paymentInstructions: str(form, "paymentInstructions"),
    holdMinutes: num(form, "holdMinutes"),
  })
}

export async function saveEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const userId = await currentUserId()
  const organizer = await getOrganizerForUser(db(), userId)
  if (!organizer) redirect(`/${lang}/dashboard`)

  const parsed = parseEvent(form)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }

  const eventId = str(form, "eventId")
  try {
    const event = eventId
      ? await updateEvent(db(), organizer, eventId, parsed.data)
      : await createEvent(db(), organizer, parsed.data)
    if (!event) return { errors: { form: "notFound" }, values: values(form) }
    redirect(`/${lang}/dashboard/events/${event.id}`)
  } catch (error) {
    if (error instanceof SlugTakenError) return { errors: { slug: "slugTaken" }, values: values(form) }
    if (error instanceof PlanLimitError) return { errors: { [error.limit === "participantsPerEvent" ? "capacity" : "form"]: error.limit }, values: values(form) }
    throw error
  }
}

export async function setEventStatusAction(form: FormData) {
  const lang = langOf(form)
  const userId = await currentUserId()
  const organizer = await getOrganizerForUser(db(), userId)
  if (!organizer) redirect(`/${lang}/dashboard`)
  const status = str(form, "status")
  if (status !== "draft" && status !== "published" && status !== "cancelled") return
  const eventId = str(form, "eventId")
  await setEventStatus(db(), organizer.id, eventId, status)
  redirect(`/${lang}/dashboard/events/${eventId}`)
}

/** Organizer approves or rejects a registration of one of their events. */
export async function decideRegistrationAction(form: FormData) {
  const lang = langOf(form)
  const userId = await currentUserId()
  const organizer = await getOrganizerForUser(db(), userId)
  if (!organizer) redirect(`/${lang}/dashboard`)
  const eventId = str(form, "eventId")
  const decision = str(form, "decision")
  if (decision !== "confirmed" && decision !== "rejected") return
  // Only events of this organizer: `decide` matches on eventId, and the event must belong to them.
  const event = await getEvent(db(), organizer.id, eventId)
  if (!event) redirect(`/${lang}/dashboard`)
  const registrationId = str(form, "registrationId")
  try {
    await decide(db(), event.id, registrationId, decision, userId, str(form, "reason").slice(0, 200))
  } catch (error) {
    if (!(error instanceof RegistrationError)) throw error
  }
  notifyLater({ eventId: event.id })
  // Keep the organizer's tab and search; from the receipt dialog, open the next receipt.
  const query = new URLSearchParams()
  for (const key of ["tab", "q"]) if (str(form, key)) query.set(key, str(form, key))
  if (str(form, "reviewNext") === "1") {
    const next = await nextToReview(db(), event.id, registrationId)
    if (next) query.set("open", next)
  }
  const qs = query.toString()
  redirect(`/${lang}/dashboard/events/${eventId}/registrations${qs ? `?${qs}` : ""}`)
}

/** Organizer page: point the bot's webhook at this site again. */
export async function reconnectTelegramAction(form: FormData) {
  const lang = langOf(form)
  const userId = await currentUserId()
  const organizer = await getOrganizerForUser(db(), userId)
  const api = telegramApiFromEnv()
  if (organizer && api) {
    try {
      await connectWebhook(api, process.env.TELEGRAM_BOT_TOKEN ?? "", SITE_URL)
    } catch (error) {
      console.error("[telegram] reconnect failed", error)
    }
  }
  redirect(`/${lang}/dashboard/organizer?tab=telegram`)
}
