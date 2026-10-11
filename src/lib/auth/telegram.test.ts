import { createHash, createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"

import { telegramDisplayName, verifyTelegramAuth } from "@/lib/auth/telegram"

const BOT = "123456:ABC-DEF"
const now = 1_800_000_000

function signed(fields: Record<string, string>) {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")
  const key = createHash("sha256").update(BOT).digest()
  return { ...fields, hash: createHmac("sha256", key).update(check).digest("hex") }
}

const base = { id: "42", first_name: "Aziza", last_name: "K", username: "aziza", auth_date: String(now - 30) }

describe("verifyTelegramAuth", () => {
  it("accepts a correctly signed login", () => {
    expect(verifyTelegramAuth(signed(base), BOT, now)).toMatchObject({ id: "42", username: "aziza" })
  })

  it("rejects a tampered field", () => {
    expect(verifyTelegramAuth({ ...signed(base), id: "43" }, BOT, now)).toBeNull()
  })

  it("rejects the wrong bot token", () => {
    expect(verifyTelegramAuth(signed(base), "other", now)).toBeNull()
  })

  it("rejects stale logins", () => {
    expect(verifyTelegramAuth(signed({ ...base, auth_date: String(now - 3600) }), BOT, now)).toBeNull()
  })

  it("ignores unknown extra params but keeps optional ones optional", () => {
    const minimal = { id: base.id, first_name: base.first_name, auth_date: base.auth_date }
    expect(verifyTelegramAuth(signed(minimal), BOT, now)).toMatchObject({ id: "42" })
  })
})

describe("telegramDisplayName", () => {
  it("prefers the full name, then username, then id", () => {
    expect(telegramDisplayName({ ...base, hash: "" })).toBe("Aziza K")
    expect(telegramDisplayName({ id: "7", first_name: "", username: "bob", auth_date: "1", hash: "" })).toBe("bob")
    expect(telegramDisplayName({ id: "7", first_name: "", auth_date: "1", hash: "" })).toBe("tg7")
  })
})
