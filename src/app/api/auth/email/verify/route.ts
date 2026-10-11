import { NextResponse } from "next/server"

import { createSessionToken, sessionCookie } from "@/lib/auth/session"
import { safeNext } from "@/lib/auth/tokens"
import { consumeLoginToken } from "@/lib/auth/users"
import { db } from "@/lib/db"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"

/** The link from the sign-in email. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const langParam = searchParams.get("lang") ?? ""
  const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE
  const token = searchParams.get("token") ?? ""

  const result = token ? await consumeLoginToken(db(), token, lang) : null
  if (!result) return NextResponse.redirect(new URL(`/${lang}/login?error=expired`, request.url))

  const response = NextResponse.redirect(new URL(safeNext(result.next, `/${lang}/dashboard`), request.url))
  response.cookies.set(sessionCookie(await createSessionToken({ userId: result.user.id })))
  return response
}
