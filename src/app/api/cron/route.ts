import { timingSafeEqual } from "node:crypto"

import { db } from "@/lib/db"
import { expireHolds, purgeOldReceipts } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"
import { telegramApiFromEnv } from "@/lib/telegram/api"
import { notifyAttendees, notifyPendingReceipts } from "@/lib/telegram/bot"

/**
 * Daily housekeeping at 02:00 Tashkent (vercel.json; Hobby plans allow one
 * run a day). Holds expire lazily whenever an event is read, so this is a
 * safety net plus the receipt purge.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response(null, { status: 401 })
  }
  const expired = await expireHolds(db())
  const purged = await purgeOldReceipts(db())
  const api = telegramApiFromEnv()
  let messaged = 0
  if (api) {
    const ctx = { db: db(), api, siteUrl: SITE_URL }
    messaged += await notifyPendingReceipts(ctx, new Date(Date.now() - 10 * 60_000))
    messaged += await notifyAttendees(ctx, undefined, 500)
  }
  return Response.json({ expired, purged, messaged })
}
