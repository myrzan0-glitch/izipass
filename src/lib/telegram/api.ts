/**
 * Minimal Telegram Bot API client. Calls are injected as a function so the
 * notification logic can be tested without the network.
 */
export type TelegramApi = (method: string, params: Record<string, unknown>, file?: { field: string; data: Buffer; contentType: string; name: string }) => Promise<unknown>

export type InlineButton = { text: string; url: string } | { text: string; callback_data: string }
export type InlineKeyboard = { inline_keyboard: InlineButton[][] }

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
  ) {
    super(`telegram ${method} ${status}: ${description}`)
  }
}

/** Overridable for local testing against a fake Bot API server. */
const apiBase = () => process.env.TELEGRAM_API_URL ?? "https://api.telegram.org"

export function createTelegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  return async (method, params, file) => {
    let body: BodyInit
    const headers: Record<string, string> = {}
    if (file) {
      const form = new FormData()
      for (const [k, v] of Object.entries(params)) if (v !== undefined) form.append(k, typeof v === "string" ? v : JSON.stringify(v))
      form.append(file.field, new Blob([new Uint8Array(file.data)], { type: file.contentType }), file.name)
      body = form
    } else {
      body = JSON.stringify(params)
      headers["content-type"] = "application/json"
    }
    const res = await fetchImpl(`${apiBase()}/bot${token}/${method}`, { method: "POST", body, headers })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string }
    if (!res.ok || !data.ok) throw new TelegramError(method, res.status, data.description ?? "unknown error")
    return data.result
  }
}

/** The bot API from the environment, or null when no bot is configured. */
export function telegramApiFromEnv(): TelegramApi | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  return token ? createTelegramApi(token) : null
}

export { webhookSecret } from "../../../scripts/telegram-secret.mjs"
