import "server-only"

import { after } from "next/server"

import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { telegramApiFromEnv } from "@/lib/telegram/api"
import { notifyAttendees, notifyReceipt } from "@/lib/telegram/bot"
import { ensureWebhook } from "@/lib/telegram/webhook"

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
      // Before sending buttons, make sure taps on them can reach us (production only:
      // previews and local runs must not take the bot over).
      if (job.receiptId && process.env.VERCEL_ENV === "production") {
        await ensureWebhook(api, process.env.TELEGRAM_BOT_TOKEN ?? "", SITE_URL).catch((error) => console.error("[telegram] webhook check failed", error))
      }
      if (job.receiptId) await notifyReceipt(ctx, job.receiptId)
      if (job.eventId !== undefined) await notifyAttendees(ctx, job.eventId ?? undefined)
    } catch (error) {
      console.error("[telegram] notify failed", error)
    }
  })
}
