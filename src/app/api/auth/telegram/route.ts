import { z } from "zod"

import { createSessionToken, getSession, sessionCookie } from "@/lib/auth/session"
import { verifyTelegramAuth } from "@/lib/auth/telegram"
import { safeNext } from "@/lib/auth/tokens"
import { AccountLinkError, linkTelegram, upsertTelegramUser } from "@/lib/auth/users"
import { db } from "@/lib/db"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"

const bodySchema = z.object({
  user: z.record(z.string(), z.union([z.string(), z.number()])),
  lang: z.string().optional(),
  next: z.string().optional(),
  /** Settings → "Connect Telegram": add it to the signed-in account. */
  link: z.boolean().optional(),
})

/** Receives the Telegram Login Widget callback data and signs the user in. */
export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return Response.json({ error: "telegram_not_configured" }, { status: 503 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 })

  const params = Object.fromEntries(Object.entries(parsed.data.user).map(([k, v]) => [k, String(v)]))
  const auth = verifyTelegramAuth(params, token)
  if (!auth) return Response.json({ error: "telegram_invalid" }, { status: 401 })

  const lang = parsed.data.lang && isLocale(parsed.data.lang) ? parsed.data.lang : DEFAULT_LOCALE
  const session = parsed.data.link ? await getSession() : null
  if (session) {
    try {
      await linkTelegram(db(), session.userId, auth)
    } catch (error) {
      if (error instanceof AccountLinkError) return Response.json({ error: error.code }, { status: 409 })
      throw error
    }
    return Response.json({ next: safeNext(parsed.data.next, `/${lang}/dashboard/settings`) })
  }
  const user = await upsertTelegramUser(db(), auth, lang)
  const response = Response.json({ next: safeNext(parsed.data.next, `/${lang}/dashboard`) })
  const cookie = sessionCookie(await createSessionToken({ userId: user.id }))
  response.headers.append("Set-Cookie", serializeCookie(cookie))
  return response
}

function serializeCookie(c: ReturnType<typeof sessionCookie>) {
  const parts = [`${c.name}=${c.value}`, `Path=${c.path}`, `Max-Age=${c.maxAge}`, `SameSite=Lax`, "HttpOnly"]
  if (c.secure) parts.push("Secure")
  return parts.join("; ")
}
