import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { PlanLimitError, createEvent, duplicateEvent, eventsThisMonth, getPublicEvent, listPublicEvents, setEventStatus } from "@/lib/events"
import { SlugTakenError, createOrganizer, getOrganizerForUser } from "@/lib/organizers"
import { organizerSchema, type EventInput } from "@/lib/validation"

let db: Db
let organizer: schema.Organizer

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
  const user = await upsertTelegramUser(db, { id: "1", first_name: "Org", auth_date: "1", hash: "" }, "ru")
  organizer = await createOrganizer(db, user.id, organizerSchema.parse({ slug: "esc", name: "English Speaking Club" }))
  expect((await getOrganizerForUser(db, user.id))?.id).toBe(organizer.id)
})

const base: EventInput = {
  slug: "thursday",
  title: "Thursday club",
  description: "",
  startsAt: new Date(Date.now() + 7 * 86_400_000),
  endsAt: null,
  venue: "Cafe",
  venueUrl: "",
  capacity: 20,
  priceUzs: 100_000,
  paymentInstructions: "Click: 8600 ...",
  holdMinutes: 30,
}

describe("events", () => {
  it("rejects duplicate organizer slugs", async () => {
    const user = await upsertTelegramUser(db, { id: "2", first_name: "Other", auth_date: "1", hash: "" }, "ru")
    await expect(createOrganizer(db, user.id, organizerSchema.parse({ slug: "esc", name: "Copy" }))).rejects.toBeInstanceOf(SlugTakenError)
  })

  it("enforces the free plan limits and unique event slugs", async () => {
    await expect(createEvent(db, organizer, { ...base, capacity: 21 })).rejects.toMatchObject({ limit: "participantsPerEvent" })
    await createEvent(db, organizer, base)
    await expect(createEvent(db, organizer, base)).rejects.toBeInstanceOf(SlugTakenError)
    await createEvent(db, organizer, { ...base, slug: "friday" })
    expect(await eventsThisMonth(db, organizer.id)).toBe(2)
    await expect(createEvent(db, organizer, { ...base, slug: "saturday" })).rejects.toBeInstanceOf(PlanLimitError)
  })

  it("only shows published events publicly", async () => {
    expect(await listPublicEvents(db, organizer.id)).toHaveLength(0)
    expect(await getPublicEvent(db, "esc", "thursday")).toBeNull()
    const [draft] = await db.select().from(schema.events).where((await import("drizzle-orm")).eq(schema.events.slug, "thursday"))
    await setEventStatus(db, organizer.id, draft.id, "published")
    expect(await listPublicEvents(db, organizer.id)).toHaveLength(1)
    expect((await getPublicEvent(db, "esc", "thursday"))?.event.title).toBe("Thursday club")
  })

  it("stops counting cancelled events against the plan", async () => {
    const [friday] = await db.select().from(schema.events).where((await import("drizzle-orm")).eq(schema.events.slug, "friday"))
    await setEventStatus(db, organizer.id, friday.id, "cancelled")
    expect(await eventsThisMonth(db, organizer.id)).toBe(1)
  })

  it("duplicates an event as a draft a week later, with a dated address", async () => {
    const pro = { ...organizer, plan: "pro" as const, planUntil: new Date(Date.now() + 86_400_000) }
    const source = await createEvent(db, pro, { ...base, slug: "weekly", startsAt: new Date("2026-11-05T14:00:00Z"), endsAt: new Date("2026-11-05T16:00:00Z") })
    const now = new Date("2026-10-11T12:00:00Z")
    const copy = (await duplicateEvent(db, pro, source.id, now))!
    expect(copy.status).toBe("draft")
    expect(copy.slug).toBe("weekly-2026-11-12")
    expect(copy.startsAt.toISOString()).toBe("2026-11-12T14:00:00.000Z")
    expect(copy.endsAt?.toISOString()).toBe("2026-11-12T16:00:00.000Z")
    expect(copy.priceUzs).toBe(source.priceUzs)
    // Copying the copy keeps one date in the address; a second copy of the source gets -2.
    expect((await duplicateEvent(db, pro, copy.id, now))!.slug).toBe("weekly-2026-11-19")
    expect((await duplicateEvent(db, pro, source.id, now))!.slug).toBe("weekly-2026-11-12-2")
    // An old event jumps to the first week after today.
    const old = await createEvent(db, pro, { ...base, slug: "old", startsAt: new Date("2026-09-03T14:00:00Z") })
    expect((await duplicateEvent(db, pro, old.id, now))!.startsAt.toISOString()).toBe("2026-10-15T14:00:00.000Z")
    // On the free plan the monthly limit still applies.
    await expect(duplicateEvent(db, organizer, source.id, now)).rejects.toBeInstanceOf(PlanLimitError)
  })
})
