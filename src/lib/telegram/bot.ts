import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { events, organizerMembers, receipts, registrations, users, type Registration, type User } from "@/lib/db/schema"
import { dictionaryFor, localeFromTelegram } from "@/lib/i18n/all"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { fmt } from "@/lib/i18n/format"
import { isMember } from "@/lib/organizers"
import { RegistrationError, decide, getRegistration } from "@/lib/registrations"
import type { InlineKeyboard, TelegramApi } from "@/lib/telegram/api"
import { ticketToken } from "@/lib/tickets"
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/time"

/**
 * The izipass Telegram bot. Everything takes the database, the bot API and
 * the site URL as arguments, so it runs the same in tests and on Vercel.
 *
 * - Organizers get each new receipt (photo + auto-check result) with
 *   Approve / Reject buttons.
 * - Attendees are told when their spot is confirmed, rejected, freed from
 *   the waitlist, or released after the payment time ran out.
 *
 * Only people who signed in with Telegram can be messaged (the login widget
 * asks for permission to write to them).
 */

type Ctx = { db: Db; api: TelegramApi; siteUrl: string }

const userLocale = (user: Pick<User, "locale">): Locale => (isLocale(user.locale) ? user.locale : "uz")

async function safely(promise: Promise<unknown>) {
  try {
    await promise
    return true
  } catch (error) {
    // A person may have blocked the bot or never allowed messages: not our failure.
    console.warn("[telegram]", (error as Error).message)
    return false
  }
}

// ── Organizers: new receipt ─────────────────────────────────────────────────

function receiptKeyboard(ctx: Ctx, locale: Locale, eventId: string, registrationId: string, pending: boolean): InlineKeyboard {
  const t = dictionaryFor(locale).bot
  const open = [{ text: t.openRegistrations, url: `${ctx.siteUrl}/${locale}/dashboard/events/${eventId}/registrations` }]
  if (!pending) return { inline_keyboard: [open] }
  return {
    inline_keyboard: [
      [
        { text: t.approve, callback_data: `a:${registrationId}` },
        { text: t.reject, callback_data: `x:${registrationId}` },
      ],
      open,
    ],
  }
}

/**
 * Tells the organizer's team about a receipt, once (the receipt is claimed
 * first, so concurrent callers can't send it twice). Returns how many people
 * were messaged, or null if it was already claimed.
 */
export async function notifyReceipt(ctx: Ctx, receiptId: string, now = new Date()) {
  const [claimed] = await ctx.db
    .update(receipts)
    .set({ notifiedAt: now })
    .where(and(eq(receipts.id, receiptId), isNull(receipts.notifiedAt)))
    .returning()
  if (!claimed) return null
  const row = await getRegistration(ctx.db, claimed.registrationId)
  if (!row) return 0
  const { registration: reg, event, organizer } = row
  const pending = reg.status === "proof_sent" || reg.status === "held"
  const autoConfirmed = reg.status === "confirmed" && !reg.decidedBy
  if (!pending && !autoConfirmed) return 0

  const team = await ctx.db
    .select({ telegramId: users.telegramId, locale: users.locale })
    .from(organizerMembers)
    .innerJoin(users, eq(users.id, organizerMembers.userId))
    .where(and(eq(organizerMembers.organizerId, organizer.id), isNotNull(users.telegramId)))

  let sent = 0
  for (const member of team) {
    const locale = userLocale(member)
    const dict = dictionaryFor(locale)
    const t = dict.bot
    const lines = [
      fmt(t.newReceipt, { event: event.title }),
      fmt(t.attendee, { name: reg.name, phone: reg.phone }),
      fmt(t.reference, { ref: reg.referenceCode, amount: formatMoney(event.priceUzs, locale) }),
    ]
    if (claimed.verdict && claimed.checks) {
      const checks = claimed.checks
      const failed = (Object.keys(checks) as (keyof typeof checks)[])
        .filter((k) => checks[k] !== "ok" && checks[k] !== "skipped")
        .map((k) => `${dict.registrations.checks[k]}: ${dict.registrations.checkResult[checks[k]]}`)
      const verdict = dict.registrations.verdict[claimed.verdict]
      lines.push(fmt(t.autoCheck, { verdict: failed.length ? `${verdict} (${failed.join(", ")})` : verdict }))
    }
    if (autoConfirmed) lines.push("", t.autoConfirmed)
    const params = {
      chat_id: member.telegramId,
      caption: lines.join("\n"),
      reply_markup: receiptKeyboard(ctx, locale, event.id, reg.id, pending),
    }
    const ext = claimed.contentType === "image/png" ? "png" : claimed.contentType === "image/webp" ? "webp" : "jpg"
    let ok = await safely(ctx.api("sendPhoto", params, { field: "photo", data: claimed.data, contentType: claimed.contentType, name: `receipt.${ext}` }))
    // A photo Telegram can't process still deserves a text message.
    if (!ok) ok = await safely(ctx.api("sendMessage", { chat_id: member.telegramId, text: params.caption, reply_markup: params.reply_markup }))
    if (ok) sent++
  }
  return sent
}

// ── Attendees: status changes ───────────────────────────────────────────────

const TELL: Registration["status"][] = ["confirmed", "rejected", "held", "expired"]

/**
 * Messages every attendee whose registration changed since they last knew
 * (decided by the organizer or auto-check, promoted from the waitlist,
 * released after the hold ran out). Each row is claimed before sending.
 */
export async function notifyAttendees(ctx: Ctx, eventId?: string, limit = 50) {
  const due = await ctx.db
    .select({ id: registrations.id, previous: registrations.notifiedStatus })
    .from(registrations)
    .where(
      and(
        inArray(registrations.status, TELL),
        sql`${registrations.notifiedStatus} is distinct from ${registrations.status}`,
        eventId ? eq(registrations.eventId, eventId) : undefined,
      ),
    )
    .limit(limit)

  let sent = 0
  for (const { id, previous } of due) {
    const [reg] = await ctx.db
      .update(registrations)
      .set({ notifiedStatus: sql`${registrations.status}` })
      .where(and(eq(registrations.id, id), sql`${registrations.notifiedStatus} is distinct from ${registrations.status}`))
      .returning()
    if (!reg) continue
    const [person] = await ctx.db.select().from(users).where(eq(users.id, reg.userId)).limit(1)
    if (!person?.telegramId) continue
    const [event] = await ctx.db.select().from(events).where(eq(events.id, reg.eventId)).limit(1)
    if (!event) continue
    const message = attendeeMessage(ctx, reg, event, userLocale(person), previous)
    if (message && (await safely(ctx.api("sendMessage", { chat_id: person.telegramId, ...message })))) sent++
  }
  return sent
}

/** Everyone still holding or waiting for a place at the event, with Telegram. */
async function liveAttendees(ctx: Ctx, eventId: string) {
  return ctx.db
    .select({ registration: registrations, user: users, event: events })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .innerJoin(events, eq(events.id, registrations.eventId))
    .where(
      and(
        eq(registrations.eventId, eventId),
        inArray(registrations.status, ["held", "proof_sent", "confirmed", "waitlist"]),
        isNotNull(users.telegramId),
      ),
    )
}

/** The organizer cancelled the event: tell everyone who registered. */
export async function notifyEventCancelled(ctx: Ctx, eventId: string) {
  let sent = 0
  for (const { registration: reg, user, event } of await liveAttendees(ctx, eventId)) {
    const locale = userLocale(user)
    const t = dictionaryFor(locale).bot
    const ok = await safely(
      ctx.api("sendMessage", {
        chat_id: user.telegramId,
        text: fmt(t.eventCancelled, { event: event.title, date: formatDateTime(event.startsAt, locale) }),
        reply_markup: { inline_keyboard: [[{ text: t.openRegistration, url: `${ctx.siteUrl}/${locale}/r/${reg.id}` }]] },
      }),
    )
    if (ok) sent++
  }
  return sent
}

/** The date, time or place changed: tell everyone who registered. */
export async function notifyEventChanged(ctx: Ctx, eventId: string) {
  let sent = 0
  for (const { registration: reg, user, event } of await liveAttendees(ctx, eventId)) {
    const locale = userLocale(user)
    const t = dictionaryFor(locale).bot
    const where = event.venue ? `\n${event.venue}` : ""
    const ok = await safely(
      ctx.api("sendMessage", {
        chat_id: user.telegramId,
        text: `${fmt(t.eventChanged, { event: event.title })}\n${formatDateRange(event.startsAt, event.endsAt, locale)}${where}`,
        reply_markup: { inline_keyboard: [[{ text: t.openRegistration, url: `${ctx.siteUrl}/${locale}/r/${reg.id}` }]] },
      }),
    )
    if (ok) sent++
  }
  return sent
}

function attendeeMessage(ctx: Ctx, reg: Registration, event: typeof events.$inferSelect, locale: Locale, previous: Registration["notifiedStatus"]) {
  const t = dictionaryFor(locale).bot
  const registrationUrl = `${ctx.siteUrl}/${locale}/r/${reg.id}`
  const open = (text: string) => ({ inline_keyboard: [[{ text, url: registrationUrl }]] })
  switch (reg.status) {
    case "confirmed":
      return {
        text: fmt(t.confirmed, { event: event.title, date: formatDateTime(event.startsAt, locale) }),
        reply_markup: {
          inline_keyboard: [
            [{ text: t.openTicket, url: registrationUrl }],
            [{ text: t.showQr, url: `${ctx.siteUrl}/${locale}/t/${ticketToken(reg.id)}` }],
          ],
        },
      }
    case "rejected":
      return {
        text: [fmt(t.rejected, { event: event.title }), reg.rejectReason ? fmt(t.reason, { reason: reg.rejectReason }) : null, t.rejectedHint]
          .filter(Boolean)
          .join("\n"),
        reply_markup: open(t.openRegistration),
      }
    case "held":
      return {
        text: reg.holdExpiresAt
          ? fmt(t.promoted, {
              event: event.title,
              amount: formatMoney(event.priceUzs, locale),
              deadline: formatDateTime(reg.holdExpiresAt, locale),
            })
          : fmt(t.promotedFree, { event: event.title }),
        reply_markup: open(t.openRegistration),
      }
    case "expired":
      // From the waitlist: registration closed before a spot opened. From a hold: the payment time ran out.
      return { text: fmt(previous === "waitlist" ? t.waitlistClosed : t.expired, { event: event.title }), reply_markup: open(t.openRegistration) }
    default:
      return null
  }
}

// ── Incoming updates (webhook) ──────────────────────────────────────────────

type TgUser = { id: number; first_name?: string; language_code?: string }
type TgMessage = { message_id: number; chat: { id: number }; from?: TgUser; text?: string; caption?: string; photo?: unknown[] }
export type TgUpdate = {
  update_id: number
  message?: TgMessage
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage }
}

/** Handles one webhook update. Never throws for bad input: Telegram would retry it. */
export async function handleUpdate(ctx: Ctx, update: TgUpdate, now = new Date()) {
  if (update.callback_query) return handleCallback(ctx, update.callback_query, now)
  const message = update.message
  if (message?.text?.startsWith("/start")) {
    const [linked] = message.from ? await ctx.db.select().from(users).where(eq(users.telegramId, String(message.from.id))).limit(1) : []
    const locale = linked ? userLocale(linked) : localeFromTelegram(message.from?.language_code)
    const t = dictionaryFor(locale).bot
    await safely(
      ctx.api("sendMessage", {
        chat_id: message.chat.id,
        text: t.start,
        reply_markup: { inline_keyboard: [[{ text: t.openSite, url: `${ctx.siteUrl}/${locale}/dashboard` }]] },
      }),
    )
  }
}

async function handleCallback(ctx: Ctx, query: NonNullable<TgUpdate["callback_query"]>, now: Date) {
  const answer = (text?: string) => safely(ctx.api("answerCallbackQuery", { callback_query_id: query.id, text, show_alert: !!text && text.length > 60 }))
  const [action, registrationId] = (query.data ?? "").split(":")
  const message = query.message
  if (!registrationId || !message || !["a", "x", "X", "b"].includes(action)) return answer()

  const [person] = await ctx.db.select().from(users).where(eq(users.telegramId, String(query.from.id))).limit(1)
  const locale = person ? userLocale(person) : localeFromTelegram(query.from.language_code)
  const dict = dictionaryFor(locale)
  const t = dict.bot
  if (!person) return answer(t.notLinked)

  const row = await getRegistration(ctx.db, registrationId)
  if (!row || !(await isMember(ctx.db, row.organizer.id, person.id))) return answer(t.notAllowed)
  const { registration: reg, event } = row
  const target = { chat_id: message.chat.id, message_id: message.message_id }
  const pending = reg.status === "proof_sent" || reg.status === "held"

  if (!pending) {
    await safely(ctx.api("editMessageReplyMarkup", { ...target, reply_markup: receiptKeyboard(ctx, locale, event.id, reg.id, false) }))
    return answer(fmt(t.alreadyDecided, { status: dict.registrationStatus[reg.status] }))
  }

  // Rejecting frees the spot, so it takes a second tap.
  if (action === "x") {
    await safely(
      ctx.api("editMessageReplyMarkup", {
        ...target,
        reply_markup: {
          inline_keyboard: [
            [
              { text: t.confirmRejectYes, callback_data: `X:${reg.id}` },
              { text: t.back, callback_data: `b:${reg.id}` },
            ],
          ],
        },
      }),
    )
    return answer(t.confirmReject)
  }
  if (action === "b") {
    await safely(ctx.api("editMessageReplyMarkup", { ...target, reply_markup: receiptKeyboard(ctx, locale, event.id, reg.id, true) }))
    return answer()
  }

  const decision = action === "a" ? "confirmed" : "rejected"
  try {
    await decide(ctx.db, event.id, reg.id, decision, person.id, "", now)
  } catch (error) {
    if (!(error instanceof RegistrationError)) throw error
    return answer(t.notAllowed)
  }
  const line = fmt(decision === "confirmed" ? t.approvedBy : t.rejectedBy, { name: person.name || query.from.first_name || "" })
  const edited = { ...target, reply_markup: receiptKeyboard(ctx, locale, event.id, reg.id, false) }
  await safely(
    message.photo
      ? ctx.api("editMessageCaption", { ...edited, caption: `${message.caption ?? ""}\n\n${line}`.trim() })
      : ctx.api("editMessageText", { ...edited, text: `${message.text ?? ""}\n\n${line}`.trim() }),
  )
  await answer()
  await notifyAttendees(ctx, event.id)
}

/** Safety net for the daily cron: receipts nobody was told about (e.g. a function died mid-way). */
export async function notifyPendingReceipts(ctx: Ctx, olderThan: Date) {
  const pending = await ctx.db
    .select({ id: receipts.id })
    .from(receipts)
    .where(and(isNull(receipts.notifiedAt), lt(receipts.createdAt, olderThan)))
    .limit(100)
  let sent = 0
  for (const { id } of pending) sent += (await notifyReceipt(ctx, id)) ?? 0
  return sent
}
