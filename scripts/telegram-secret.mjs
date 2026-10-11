import { createHmac } from "node:crypto"

/**
 * Secret Telegram sends back in `X-Telegram-Bot-Api-Secret-Token` on every
 * webhook call. Derived from the bot token, so there is no extra env var.
 * Shared by the build script and the app (src/lib/telegram/api.ts).
 */
export function webhookSecret(token) {
  return createHmac("sha256", token).update("izipass:telegram-webhook").digest("base64url")
}
