import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { getRegistration } from "@/lib/registrations"
import { WalletServiceError, googleSaveUrl, walletTicket } from "@/lib/tickets"

/** Sends the attendee to the Google Wallet save page for their ticket. */
export async function GET(request: Request, { params }: RouteContext<"/api/tickets/[id]/google">) {
  const { id } = await params
  const langParam = new URL(request.url).searchParams.get("lang") ?? ""
  const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE
  const back = (error: string) => NextResponse.redirect(new URL(`/${lang}/r/${id}?wallet=${error}`, request.url))

  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL(`/${lang}/login?next=${encodeURIComponent(`/${lang}/r/${id}`)}`, request.url))
  const row = await getRegistration(db(), id)
  if (!row || row.registration.userId !== session.userId) return new Response(null, { status: 404 })
  if (row.registration.status !== "confirmed") return back("not_confirmed")
  // The registration page explains a cancelled event; no pass for it.
  if (row.event.status === "cancelled") return NextResponse.redirect(new URL(`/${lang}/r/${id}`, request.url))

  try {
    return NextResponse.redirect(await googleSaveUrl(walletTicket(row.registration, row.event, row.organizer, lang)))
  } catch (error) {
    if (error instanceof WalletServiceError) return back(error.code)
    throw error
  }
}
