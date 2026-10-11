import { webhookSecret, type TelegramApi } from "@/lib/telegram/api"

/**
 * Button taps reach izipass only through the bot's webhook. These helpers
 * read and repair it, so a missed setup at deploy time fixes itself.
 */
export const WEBHOOK_PATH = "/api/telegram/webhook"
const ALLOWED_UPDATES = ["message", "callback_query"]

type WebhookInfo = { url?: string; pending_update_count?: number; last_error_date?: number; last_error_message?: string }

export type WebhookStatus = {
  connected: boolean
  url: string
  expected: string
  pending: number
  /** Telegram's last delivery error, if it happened in the last day. */
  lastError: string | null
}

export async function webhookStatus(api: TelegramApi, siteUrl: string, now = Date.now()): Promise<WebhookStatus> {
  const info = (await api("getWebhookInfo", {})) as WebhookInfo
  const expected = `${siteUrl.replace(/\/$/, "")}${WEBHOOK_PATH}`
  const recent = !!info.last_error_date && now - info.last_error_date * 1000 < 86_400_000
  return {
    connected: info.url === expected,
    url: info.url ?? "",
    expected,
    pending: info.pending_update_count ?? 0,
    lastError: recent ? (info.last_error_message ?? null) : null,
  }
}

export async function connectWebhook(api: TelegramApi, token: string, siteUrl: string) {
  await api("setWebhook", {
    url: `${siteUrl.replace(/\/$/, "")}${WEBHOOK_PATH}`,
    secret_token: webhookSecret(token),
    allowed_updates: ALLOWED_UPDATES,
  })
}

const CHECK_EVERY_MS = 10 * 60_000
let lastCheck = 0

/**
 * Points the webhook at this site if it points elsewhere, or if Telegram
 * reports recent delivery errors (e.g. a secret from an older token).
 * At most once per 10 minutes per server instance.
 */
export async function ensureWebhook(api: TelegramApi, token: string, siteUrl: string, now = Date.now()) {
  if (now - lastCheck < CHECK_EVERY_MS) return false
  lastCheck = now
  const status = await webhookStatus(api, siteUrl, now)
  if (status.connected && !status.lastError) return false
  await connectWebhook(api, token, siteUrl)
  console.log(`[telegram] webhook reconnected (was ${status.url || "empty"}${status.lastError ? `, error: ${status.lastError}` : ""})`)
  return true
}

/** For tests. */
export function resetWebhookCheck() {
  lastCheck = 0
}
