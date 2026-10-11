import { NextResponse } from "next/server"

import { clearedSessionCookie } from "@/lib/auth/session"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const langValue = String(form?.get("lang") ?? "")
  const lang = isLocale(langValue) ? langValue : DEFAULT_LOCALE
  const response = NextResponse.redirect(new URL(`/${lang}`, request.url), { status: 303 })
  response.cookies.set(clearedSessionCookie())
  return response
}
