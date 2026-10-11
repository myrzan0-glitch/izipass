import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { consumeLoginToken, getUser, issueLoginToken, upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"

let db: Db

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
})

const tg = { id: "42", first_name: "Aziza", last_name: "K", username: "aziza", auth_date: "1", hash: "" }

describe("users", () => {
  it("creates a Telegram user once and updates it on later logins", async () => {
    const first = await upsertTelegramUser(db, tg, "ru")
    const second = await upsertTelegramUser(db, { ...tg, username: "aziza_k" }, "uz")
    expect(second.id).toBe(first.id)
    expect(second.telegramUsername).toBe("aziza_k")
    expect(second.locale).toBe("ru")
    expect(await getUser(db, first.id)).toMatchObject({ name: "Aziza K" })
  })

  it("signs in by email link exactly once", async () => {
    const { token } = await issueLoginToken(db, "New@Example.com", "/ru/dashboard")
    const result = await consumeLoginToken(db, token, "ru")
    expect(result?.user.email).toBe("new@example.com")
    expect(result?.next).toBe("/ru/dashboard")
    expect(await consumeLoginToken(db, token, "ru")).toBeNull()
  })

  it("reuses the user for the same email in another case", async () => {
    const a = await consumeLoginToken(db, (await issueLoginToken(db, "same@example.com", null)).token, "en")
    const b = await consumeLoginToken(db, (await issueLoginToken(db, "SAME@example.com", null)).token, "en")
    expect(b?.user.id).toBe(a?.user.id)
  })

  it("rejects unknown tokens", async () => {
    expect(await consumeLoginToken(db, "nope", "en")).toBeNull()
  })
})
