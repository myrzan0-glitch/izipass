import { z } from "zod"

import { getSession } from "@/lib/auth/session"
import { safeNext } from "@/lib/auth/tokens"
import { issueLoginToken } from "@/lib/auth/users"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { isTestStand } from "@/lib/test-stand"

const bodySchema = z.object({
  email: z.email(),
  lang: z.string().optional(),
  next: z.string().optional(),
  /** Settings → "Add email": the link adds the address to the signed-in account. */
  link: z.boolean().optional(),
})

const SUBJECT: Record<Locale, string> = {
  uz: "izipass’ga kirish havolasi",
  ru: "Ссылка для входа в izipass",
  kk: "izipass-қа кіру сілтемесі",
  en: "Your izipass sign-in link",
}
const BODY: Record<Locale, string> = {
  uz: "Kirish uchun havolani bosing (15 daqiqa amal qiladi):",
  ru: "Нажмите ссылку, чтобы войти (действует 15 минут):",
  kk: "Кіру үшін сілтемені басыңыз (15 минут жарамды):",
  en: "Click the link to sign in (valid for 15 minutes):",
}

/** Emails a one-time sign-in link. Always answers 200 so addresses can't be probed. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "invalid_email" }, { status: 400 })

  const lang = parsed.data.lang && isLocale(parsed.data.lang) ? parsed.data.lang : DEFAULT_LOCALE
  const next = safeNext(parsed.data.next, `/${lang}/events`)
  const session = parsed.data.link ? await getSession() : null
  const { email, token } = await issueLoginToken(db(), parsed.data.email, next, session?.userId ?? null)

  const url = new URL("/api/auth/email/verify", SITE_URL)
  url.searchParams.set("token", token)
  url.searchParams.set("lang", lang)
  await sendEmail({
    to: email,
    subject: SUBJECT[lang],
    text: `${BODY[lang]}\n\n${url}\n\n${SITE_NAME}`,
    html: `<p>${BODY[lang]}</p><p><a href="${url}">${url}</a></p><p>${SITE_NAME}</p>`,
  })
  // The test stand sends no email, so the link comes back to be shown on screen.
  return Response.json(isTestStand() ? { ok: true, link: url.toString() } : { ok: true })
}
