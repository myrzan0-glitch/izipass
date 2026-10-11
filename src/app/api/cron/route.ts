import { timingSafeEqual } from "node:crypto"

import { db } from "@/lib/db"
import { expireHolds, purgeOldReceipts } from "@/lib/registrations"

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
  return Response.json({ expired, purged })
}
