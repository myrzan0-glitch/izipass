import { createHmac, timingSafeEqual } from "node:crypto"

import type { Event, Organizer, Registration } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import { SITE_URL } from "@/lib/site"

const SIG_LENGTH = 22

function key() {
  const secret = process.env.TICKET_SECRET ?? process.env.SESSION_SECRET
  if (!secret) throw new Error("TICKET_SECRET or SESSION_SECRET must be set")
  return `ticket:${secret}`
}

function sign(id: string) {
  return createHmac("sha256", key()).update(id).digest("base64url").slice(0, SIG_LENGTH)
}

/**
 * `<registrationId>~<signature>`: what the QR code carries. Nothing is stored.
 * `~` rather than `.` so the path isn't mistaken for a file by the locale proxy.
 */
export function ticketToken(registrationId: string) {
  return `${registrationId}~${sign(registrationId)}`
}

export function ticketUrl(registrationId: string) {
  return `${SITE_URL}/t/${ticketToken(registrationId)}`
}

/** Registration id from a token, or null if the signature doesn't match. */
export function parseTicketToken(token: string): string | null {
  const sep = token.lastIndexOf("~")
  if (sep <= 0) return null
  const id = token.slice(0, sep)
  const given = Buffer.from(token.slice(sep + 1))
  const expected = Buffer.from(sign(id))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return id
}

/** Ticket description for the wallet pass service. */
export function walletTicket(reg: Registration, event: Event, organizer: Organizer, locale: Locale) {
  return {
    id: reg.id,
    title: event.title,
    organizer: organizer.name,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    venue: event.venue,
    venueUrl: event.venueUrl || null,
    attendee: reg.name,
    reference: reg.referenceCode,
    url: ticketUrl(reg.id),
    origins: [SITE_URL],
    locale,
  }
}

export class WalletServiceError extends Error {
  constructor(public readonly code: "unavailable" | "failed") {
    super(code)
  }
}

/** Calls wallet.myrzan.com, which holds the Apple/Google credentials. */
async function requestPass(platform: "apple" | "google", ticket: ReturnType<typeof walletTicket>) {
  const base = process.env.WALLET_API_URL ?? "https://wallet.myrzan.com"
  const apiKey = process.env.WALLET_API_KEY
  if (!apiKey) throw new WalletServiceError("unavailable")
  const res = await fetch(`${base}/api/v1/passes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ platform, ticket }),
    cache: "no-store",
  })
  if (!res.ok) {
    // 401: WALLET_API_KEY here doesn't match WALLET_API_KEYS in the wallet project.
    // 503: the wallet project lacks Apple/Google credentials. 422: ticket data rejected.
    console.error(`[wallet] ${platform} pass: ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`)
    throw new WalletServiceError(res.status === 503 ? "unavailable" : "failed")
  }
  return res
}

export async function applePass(ticket: ReturnType<typeof walletTicket>) {
  return Buffer.from(await (await requestPass("apple", ticket)).arrayBuffer())
}

export async function googleSaveUrl(ticket: ReturnType<typeof walletTicket>) {
  const data = (await (await requestPass("google", ticket)).json()) as { saveUrl?: string }
  if (!data.saveUrl) throw new WalletServiceError("failed")
  return data.saveUrl
}
