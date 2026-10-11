// Points the Telegram bot at this deployment: webhook + command list.
// Runs during `npm run build`, only for Vercel production deploys (preview
// builds must not steal the webhook). Never fails the build.
import { createHmac } from "node:crypto"
import { pathToFileURL } from "node:url"

/** Must match webhookSecret() in src/lib/telegram/api.ts (a test checks this). */
export function webhookSecret(token) {
  return createHmac("sha256", token).update("izipass:telegram-webhook").digest("base64url")
}

const COMMANDS = {
  uz: "Bot haqida",
  ru: "О боте",
  kk: "Бот туралы",
  en: "About the bot",
}

async function call(token, method, params) {
  const res = await fetch(`${process.env.TELEGRAM_API_URL ?? "https://api.telegram.org"}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.ok) throw new Error(`${method}: ${data.description ?? res.status}`)
  return data.result
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://izipass.myrzan.com").replace(/\/$/, "")
  if (!token) return console.log("telegram: no TELEGRAM_BOT_TOKEN, skipped")
  if (process.env.VERCEL_ENV !== "production") return console.log("telegram: not a production deploy, webhook left as is")
  const url = `${site}/api/telegram/webhook`
  await call(token, "setWebhook", { url, secret_token: webhookSecret(token), allowed_updates: ["message", "callback_query"] })
  await call(token, "setMyCommands", { commands: [{ command: "start", description: COMMANDS.en }] })
  for (const [lang, description] of Object.entries(COMMANDS)) {
    await call(token, "setMyCommands", { commands: [{ command: "start", description }], language_code: lang })
  }
  console.log(`telegram: webhook set to ${url}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => console.warn(`telegram: setup failed (${error.message}); the bot won't receive button taps until the next deploy`))
}
