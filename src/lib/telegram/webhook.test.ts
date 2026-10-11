import { beforeEach, describe, expect, it } from "vitest"

import { webhookSecret, type TelegramApi } from "@/lib/telegram/api"
import { ensureWebhook, resetWebhookCheck, webhookStatus } from "@/lib/telegram/webhook"

const SITE = "https://izipass.test"
const NOW = Date.parse("2026-10-11T12:00:00Z")

function fakeBot(info: Record<string, unknown>) {
  const calls: { method: string; params: Record<string, unknown> }[] = []
  const api: TelegramApi = async (method, params) => {
    calls.push({ method, params })
    if (method === "getWebhookInfo") return info
    if (method === "setWebhook") info.url = params.url
    return true
  }
  return { api, calls }
}

beforeEach(() => resetWebhookCheck())

describe("webhook", () => {
  it("reports whether taps reach this site, with Telegram's recent error", async () => {
    const { api } = fakeBot({ url: `${SITE}/api/telegram/webhook`, last_error_date: NOW / 1000 - 60, last_error_message: "Wrong response from the webhook: 401 Unauthorized" })
    expect(await webhookStatus(api, SITE, NOW)).toMatchObject({ connected: true, lastError: "Wrong response from the webhook: 401 Unauthorized" })
    const old = fakeBot({ url: "", last_error_date: NOW / 1000 - 3 * 86_400, last_error_message: "old" })
    expect(await webhookStatus(old.api, `${SITE}/`, NOW)).toMatchObject({ connected: false, url: "", expected: `${SITE}/api/telegram/webhook`, lastError: null })
  })

  it("connects a missing webhook with the secret, then leaves it alone", async () => {
    const { api, calls } = fakeBot({ url: "" })
    expect(await ensureWebhook(api, "123:abc", SITE, NOW)).toBe(true)
    expect(calls[1]).toEqual({
      method: "setWebhook",
      params: { url: `${SITE}/api/telegram/webhook`, secret_token: webhookSecret("123:abc"), allowed_updates: ["message", "callback_query"] },
    })
    // Rate limited, then a healthy webhook is not touched.
    expect(await ensureWebhook(api, "123:abc", SITE, NOW + 60_000)).toBe(false)
    expect(await ensureWebhook(api, "123:abc", SITE, NOW + 11 * 60_000)).toBe(false)
    expect(calls.filter((c) => c.method === "setWebhook")).toHaveLength(1)
  })

  it("repairs a webhook that Telegram can't deliver to", async () => {
    const { api, calls } = fakeBot({ url: `${SITE}/api/telegram/webhook`, last_error_date: NOW / 1000 - 30, last_error_message: "Wrong response from the webhook: 401 Unauthorized" })
    expect(await ensureWebhook(api, "123:abc", SITE, NOW)).toBe(true)
    expect(calls.map((c) => c.method)).toEqual(["getWebhookInfo", "setWebhook"])
  })
})
