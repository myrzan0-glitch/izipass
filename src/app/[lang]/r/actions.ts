"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import type { ActionState } from "@/app/[lang]/dashboard/actions"
import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { getPublicEvent } from "@/lib/events"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { RegistrationError, cancelRegistration, register } from "@/lib/registrations"
import { fieldErrors } from "@/lib/validation"

const registerSchema = z.object({
  name: z.string().trim().min(2, "required").max(80, "tooLong"),
  phone: z
    .string()
    .trim()
    .transform((p) => p.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{9,15}$/, "phone")),
  note: z.string().trim().max(500, "tooLong").default(""),
})

const str = (form: FormData, key: string) => String(form.get(key) ?? "")

function langOf(form: FormData) {
  const lang = str(form, "lang")
  return isLocale(lang) ? lang : DEFAULT_LOCALE
}

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const lang = langOf(form)
  const organizerSlug = str(form, "organizer")
  const eventSlug = str(form, "event")
  const session = await getSession()
  if (!session) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/o/${organizerSlug}/${eventSlug}/register`)}`)

  const parsed = registerSchema.safeParse({ name: str(form, "name"), phone: str(form, "phone"), note: str(form, "note") })
  const values = { name: str(form, "name"), phone: str(form, "phone"), note: str(form, "note") }
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values }

  const row = await getPublicEvent(db(), organizerSlug, eventSlug)
  if (!row) return { errors: { form: "notFound" }, values }

  let id: string
  try {
    id = (await register(db(), row.event, row.organizer.slug, session.userId, parsed.data)).id
  } catch (error) {
    if (error instanceof RegistrationError) return { errors: { form: `registration_${error.code}` }, values }
    throw error
  }
  redirect(`/${lang}/r/${id}`)
}

export async function cancelRegistrationAction(form: FormData) {
  const lang = langOf(form)
  const session = await getSession()
  if (!session) redirect(`/${lang}/login`)
  const id = str(form, "registrationId")
  try {
    await cancelRegistration(db(), id, session.userId)
  } catch (error) {
    if (!(error instanceof RegistrationError)) throw error
  }
  redirect(`/${lang}/r/${id}`)
}
