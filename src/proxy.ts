import { match } from "@formatjs/intl-localematcher"
import { jwtVerify } from "jose"
import Negotiator from "negotiator"
import { NextResponse, type NextRequest } from "next/server"

import { DEFAULT_LOCALE, LOCALES, isLocale } from "@/lib/i18n/config"

const SESSION_COOKIE = "session"
const PROTECTED = ["dashboard"]

function preferredLocale(request: NextRequest) {
  const cookie = request.cookies.get("locale")?.value
  if (cookie && isLocale(cookie)) return cookie
  const headers = { "accept-language": request.headers.get("accept-language") ?? "" }
  const languages = new Negotiator({ headers }).languages()
  try {
    return match(languages, LOCALES, DEFAULT_LOCALE)
  } catch {
    return DEFAULT_LOCALE
  }
}

async function hasSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const secret = process.env.SESSION_SECRET
  if (!token || !secret) return false
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] })
    return true
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const [, first, second] = pathname.split("/")

  if (!isLocale(first)) {
    request.nextUrl.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`
    return NextResponse.redirect(request.nextUrl)
  }

  // Signed-in area: bounce to login, remembering where the user was going.
  if (PROTECTED.includes(second) && !(await hasSession(request))) {
    const login = request.nextUrl.clone()
    login.pathname = `/${first}/login`
    login.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(login)
  }
}

export const config = {
  // Skip API routes, Next and Vercel internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
