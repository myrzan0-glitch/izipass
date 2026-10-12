import { PGlite } from "@electric-sql/pglite"
import { eq, like } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { TEST_ORGANIZER_SLUG, isTestStand, seedTestStand } from "@/lib/test-stand"

let db: Db

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
})

afterEach(() => vi.unstubAllEnvs())

const counts = async () => ({
  users: (await db.select().from(schema.users).where(like(schema.users.email, "%@izipass.test"))).length,
  events: (await db.select().from(schema.events)).length,
  registrations: (await db.select().from(schema.registrations)).length,
  receipts: (await db.select().from(schema.receipts)).length,
})

describe("test stand", () => {
  it("is on only with TEST_STAND=1, and never on the production domain", () => {
    vi.stubEnv("TEST_STAND", "")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://test.izipass.myrzan.com")
    expect(isTestStand()).toBe(false)
    vi.stubEnv("TEST_STAND", "1")
    expect(isTestStand()).toBe(true)
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://izipass.myrzan.com")
    expect(isTestStand()).toBe(false)
  })

  it("seeds four accounts and the Test Club once, and resets to the start", async () => {
    await seedTestStand(db)
    const first = await counts()
    expect(first).toEqual({ users: 4, events: 5, registrations: 9, receipts: 1 })

    await seedTestStand(db)
    expect(await counts()).toEqual(first)

    // What testers create goes away on reset: here an extra event.
    const [club] = await db.select().from(schema.organizers).where(eq(schema.organizers.slug, TEST_ORGANIZER_SLUG))
    await db.insert(schema.events).values({ organizerId: club.id, slug: "extra", title: "Extra", startsAt: new Date(), capacity: 5 })
    await seedTestStand(db, { reset: true })
    expect(await counts()).toEqual(first)

    const statuses = (await db.select({ status: schema.registrations.status }).from(schema.registrations)).map((r) => r.status).sort()
    expect(statuses).toEqual(["confirmed", "confirmed", "confirmed", "confirmed", "confirmed", "confirmed", "confirmed", "held", "proof_sent"])
  })
})
