import { timingSafeEqual } from "node:crypto"

import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { createTelegramApi, webhookSecret } from "@/lib/telegram/api"
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot"

/**
 * Telegram calls this for messages to the bot and button taps. Registered
 * on every production deploy by scripts/telegram-setup.mjs.
 */
export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return new Response(null, { status: 404 })
  const given = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "")
  const expected = Buffer.from(webhookSecret(token))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response(null, { status: 401 })

  const update = (await request.json().catch(() => null)) as TgUpdate | null
  if (update) {
    try {
      await handleUpdate({ db: db(), api: createTelegramApi(token), siteUrl: SITE_URL }, update)
    } catch (error) {
      // Answer 200 anyway: Telegram would otherwise retry the same update forever.
      console.error("[telegram] update failed", error)
    }
  }
  return Response.json({ ok: true })
}
