"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { clearedSessionCookie, getSession } from "@/lib/auth/session"
import { deleteAccount, updateProfile } from "@/lib/auth/users"
import type { Event, Organizer } from "@/lib/db/schema"
import { db } from "@/lib/db"
import {
  EventRuleError,
  PlanLimitError,
  checkEventInput,
  createEvent,
  deleteDraft,
  duplicateEvent,
  liveRegistrationCount,
  setEventStatus,
  updateEvent,
} from "@/lib/events"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { IMAGE_MAX_BYTES, IMAGE_TYPES, setCover } from "@/lib/images"
import {
  SlugTakenError,
  createOrganizer,
  createOrganizerFromName,
  getEventForMember,
  getMemberOrganizer,
  listOrganizersForUser,
  updateOrganizer,
  updatePaymentSettings,
} from "@/lib/organizers"
import { RegistrationError, decide, nextToReview } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"
import { telegramApiFromEnv } from "@/lib/telegram/api"
import { connectWebhook } from "@/lib/telegram/webhook"
import { fromLocalInput } from "@/lib/time"
import { eventSchema, fieldErrors, organizerSchema, paymentSettingsSchema, profileSchema } from "@/lib/validation"
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

/** The event from the form, when the signed-in person is a member of its organization. */
async function eventAccess(form: FormData): Promise<{ userId: string; event: Event; organizer: Organizer }> {
  const userId = await currentUserId()
  const access = await getEventForMember(db(), userId, str(form, "eventId"))
  if (!access) redirect(`/${langOf(form)}/dashboard`)
  return { userId, ...access }
}

/** The organization from the form, when the signed-in person is a member of it. */
async function organizerAccess(form: FormData): Promise<{ userId: string; organizer: Organizer }> {
  const userId = await currentUserId()
  const organizer = await getMemberOrganizer(db(), userId, str(form, "organizerId"))
  if (!organizer) redirect(`/${langOf(form)}/dashboard/organizations`)
  return { userId, organizer }
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

/** Creates an organization (no organizerId) or updates one the person is a member of. */
export async function saveOrganizerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const userId = await currentUserId()
  const parsed = parseOrganizer(form)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }

  const organizerId = str(form, "organizerId")
  let saved
  try {
    if (organizerId) {
      const existing = await getMemberOrganizer(db(), userId, organizerId)
      if (!existing) return { errors: { form: "notFound" }, values: values(form) }
      saved = await updateOrganizer(db(), existing.id, parsed.data)
    } else {
      saved = await createOrganizer(db(), userId, parsed.data)
    }
  } catch (error) {
    if (error instanceof SlugTakenError) return { errors: { slug: "slugTaken" }, values: values(form) }
    throw error
  }
  redirect(organizerId ? `/${lang}/dashboard/organizations/${saved.id}/settings?saved=1` : `/${lang}/dashboard/organizations/${saved.id}`)
}

/** Organizer settings → Payments: auto-check add-on and payout card details. */
export async function savePaymentSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const { organizer } = await organizerAccess(form)
  const parsed = paymentSettingsSchema.safeParse({
    autoCheck: str(form, "autoCheck") === "on",
    autoApprove: str(form, "autoApprove") === "on",
    payoutCardLast4: str(form, "payoutCardLast4"),
    payoutName: str(form, "payoutName"),
  })
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }
  await updatePaymentSettings(db(), organizer.id, parsed.data)
  redirect(`/${lang}/dashboard/organizations/${organizer.id}/payments?saved=1`)
}

/** Copies an event as a draft a week later (weekly clubs). */
export async function duplicateEventAction(form: FormData) {
  const lang = langOf(form)
  const { organizer, event } = await eventAccess(form)
  const eventId = event.id
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
    paymentTo: str(form, "paymentTo"),
    paymentInstructions: str(form, "paymentInstructions"),
    holdMinutes: num(form, "holdMinutes"),
    registrationClosesBefore: num(form, "registrationClosesBefore") || 0,
  })
}

/** Where a saved event form returns: the tab it was opened from. */
const RETURN_TABS = new Set(["registration", "more"])

/**
 * Creates or updates an event. A new event goes to one of the person's
 * organizations, or, for their first event, to a new one made from a name.
 */
export async function saveEventAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const userId = await currentUserId()

  const parsed = parseEvent(form)
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }

  const eventId = str(form, "eventId")
  let organizer: Organizer | null = null
  let existing: Event | null = null
  if (eventId) {
    const access = await getEventForMember(db(), userId, eventId)
    if (!access) return { errors: { form: "notFound" }, values: values(form) }
    ;({ organizer, event: existing } = access)
  } else if (str(form, "organizerId")) {
    organizer = await getMemberOrganizer(db(), userId, str(form, "organizerId"))
    if (!organizer) return { errors: { form: "notFound" }, values: values(form) }
  } else {
    const name = str(form, "organizerName").trim()
    if (name.length < 2) return { errors: { organizerName: "required" }, values: values(form) }
    if (name.length > 60) return { errors: { organizerName: "tooLong" }, values: values(form) }
    // Only for a first event: people with an organization pick it instead.
    if ((await listOrganizersForUser(db(), userId)).length > 0) return { errors: { form: "generic" }, values: values(form) }
  }

  let saved
  try {
    await checkEventInput(db(), parsed.data, existing)
    organizer ??= await createOrganizerFromName(db(), userId, str(form, "organizerName").trim())
    saved = existing ? await updateEvent(db(), organizer, existing.id, parsed.data) : await createEvent(db(), organizer, parsed.data)
  } catch (error) {
    if (error instanceof SlugTakenError) return { errors: { slug: "slugTaken" }, values: values(form) }
    if (error instanceof PlanLimitError) return { errors: { [error.limit === "participantsPerEvent" ? "capacity" : "form"]: error.limit }, values: values(form) }
    // "code:n" carries the number for messages like "3 spots are already taken".
    if (error instanceof EventRuleError)
      return { errors: { [error.code === "capacityBelowTaken" ? "capacity" : "startsAt"]: `${error.code}:${error.n}` }, values: values(form) }
    throw error
  }
  if (!saved) return { errors: { form: "notFound" }, values: values(form) }
  // Create event sends the cover with the form (already shrunk in the browser).
  const cover = form.get("cover")
  if (!existing && cover instanceof File && cover.size > 0 && IMAGE_TYPES.has(cover.type) && cover.size <= IMAGE_MAX_BYTES) {
    await setCover(db(), organizer.id, saved.id, { contentType: cover.type, data: Buffer.from(await cover.arrayBuffer()) })
  }
  // People already registered hear about a new date, time or place.
  if (
    existing &&
    saved.status === "published" &&
    (existing.startsAt.getTime() !== saved.startsAt.getTime() ||
      (existing.endsAt?.getTime() ?? 0) !== (saved.endsAt?.getTime() ?? 0) ||
      existing.venue !== saved.venue) &&
    (await liveRegistrationCount(db(), saved.id)) > 0
  ) {
    notifyLater({ eventChanged: saved.id })
  }
  const tab = str(form, "returnTo")
  redirect(`/${lang}/dashboard/events/${saved.id}${RETURN_TABS.has(tab) ? `/${tab}` : ""}${existing ? "?saved=1" : ""}`)
}

export async function setEventStatusAction(form: FormData) {
  const lang = langOf(form)
  const { organizer, event: current } = await eventAccess(form)
  const status = str(form, "status")
  if (status !== "draft" && status !== "published" && status !== "cancelled") return
  const eventId = current.id
  let error: string | null = null
  try {
    const event = await setEventStatus(db(), organizer.id, eventId, status)
    if (event && status === "cancelled") notifyLater({ eventCancelled: event.id })
  } catch (e) {
    if (e instanceof PlanLimitError) error = e.limit
    else if (e instanceof EventRuleError) error = `${e.code}&n=${e.n}`
    else throw e
  }
  const tab = str(form, "returnTo")
  redirect(`/${lang}/dashboard/events/${eventId}${RETURN_TABS.has(tab) ? `/${tab}` : ""}${error ? `?error=${error}` : ""}`)
}

/** Deletes a draft nobody registered for. */
export async function deleteDraftAction(form: FormData) {
  const lang = langOf(form)
  const { organizer, event } = await eventAccess(form)
  const eventId = event.id
  try {
    if (await deleteDraft(db(), organizer.id, eventId)) redirect(`/${lang}/dashboard`)
  } catch (e) {
    if (!(e instanceof EventRuleError)) throw e
  }
  redirect(`/${lang}/dashboard/events/${eventId}/more?error=hasRegistrations`)
}

/** Organizer approves or rejects a registration of one of their events. */
export async function decideRegistrationAction(form: FormData) {
  const lang = langOf(form)
  // Only events of the person's organizations: `decide` matches on eventId.
  const { userId, event } = await eventAccess(form)
  const eventId = event.id
  const decision = str(form, "decision")
  if (decision !== "confirmed" && decision !== "rejected") return
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
  redirect(`/${lang}/dashboard/events/${eventId}/guests${qs ? `?${qs}` : ""}`)
}

/** Organizer page: point the bot's webhook at this site again. */
export async function reconnectTelegramAction(form: FormData) {
  const lang = langOf(form)
  const { organizer } = await organizerAccess(form)
  const api = telegramApiFromEnv()
  if (api) {
    try {
      await connectWebhook(api, process.env.TELEGRAM_BOT_TOKEN ?? "", SITE_URL)
    } catch (error) {
      console.error("[telegram] reconnect failed", error)
    }
  }
  redirect(`/${lang}/dashboard/organizations/${organizer.id}/telegram`)
}

/** More tab → Event link: change only the address. */
export async function saveEventSlugAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const { event, organizer } = await eventAccess(form)
  const parsed = eventSchema.safeParse({ ...event, venueUrl: event.venueUrl ?? "", slug: str(form, "slug") })
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }
  try {
    await updateEvent(db(), organizer, event.id, parsed.data)
  } catch (error) {
    if (error instanceof SlugTakenError) return { errors: { slug: "slugTaken" }, values: values(form) }
    if (error instanceof PlanLimitError) return { errors: { slug: error.limit }, values: values(form) }
    throw error
  }
  redirect(`/${lang}/dashboard/events/${event.id}/more?saved=1`)
}

/** Settings → Your profile. The language also switches the site to it. */
export async function saveProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await currentUserId()
  const parsed = profileSchema.safeParse({ name: str(form, "name"), phone: str(form, "phone"), locale: str(form, "locale") })
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: values(form) }
  await updateProfile(db(), userId, parsed.data)
  redirect(`/${parsed.data.locale}/dashboard/settings?saved=1`)
}

/** Settings → Delete account. Owners of an organization can't (yet). */
export async function deleteAccountAction(form: FormData) {
  const lang = langOf(form)
  const userId = await currentUserId()
  if (!(await deleteAccount(db(), userId))) redirect(`/${lang}/dashboard/settings?error=ownsOrganization`)
  ;(await cookies()).set(clearedSessionCookie())
  redirect(`/${lang}`)
}
