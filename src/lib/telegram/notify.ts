import "server-only"

import { after } from "next/server"

import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { telegramApiFromEnv } from "@/lib/telegram/api"
import { notifyAttendees, notifyReceipt } from "@/lib/telegram/bot"

/**
 * Sends Telegram messages after the response, so a slow or failing Telegram
 * never slows down or breaks the page. No-op without a bot token.
 *
 * - `receiptId`: tell the organizers about this receipt (once).
 * - `eventId`: tell attendees of this event about status changes; `null` = all events.
 * - `delayMs`: wait first (gives in-browser auto-check time to finish).
 */
export function notifyLater(job: { receiptId?: string; eventId?: string | null; delayMs?: number }) {
  const api = telegramApiFromEnv()
  if (!api) return
  after(async () => {
    try {
      if (job.delayMs) await new Promise((resolve) => setTimeout(resolve, job.delayMs))
      const ctx = { db: db(), api, siteUrl: SITE_URL }
      if (job.receiptId) await notifyReceipt(ctx, job.receiptId)
      if (job.eventId !== undefined) await notifyAttendees(ctx, job.eventId ?? undefined)
    } catch (error) {
      console.error("[telegram] notify failed", error)
    }
  })
}
