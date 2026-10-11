import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { EventRuleError, PlanLimitError, checkEventInput, createEvent, deleteDraft, duplicateEvent, eventsThisMonth, getPublicEvent, listPastPublicEvents, listPublicEvents, registrationOpen, setEventStatus } from "@/lib/events"
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
    registrationClosesBefore: 0,
}

describe("events", () => {
  it("rejects duplicate organizer slugs", async () => {
    const user = await upsertTelegramUser(db, { id: "2", first_name: "Other", auth_date: "1", hash: "" }, "ru")
    await expect(createOrganizer(db, user.id, organizerSchema.parse({ slug: "esc", name: "Copy" }))).rejects.toBeInstanceOf(SlugTakenError)
  })

  it("enforces the free plan limits at publishing, and unique event slugs", async () => {
    await expect(createEvent(db, organizer, { ...base, capacity: 21 })).rejects.toMatchObject({ limit: "participantsPerEvent" })
    await createEvent(db, organizer, base)
    await expect(createEvent(db, organizer, base)).rejects.toBeInstanceOf(SlugTakenError)
    await createEvent(db, organizer, { ...base, slug: "friday" })
    const saturday = await createEvent(db, organizer, { ...base, slug: "saturday" })
    // Drafts are free; only published events count.
    expect(await eventsThisMonth(db, organizer.id)).toBe(0)
    const sunday = await createEvent(db, organizer, { ...base, slug: "sunday" })
    await setEventStatus(db, organizer.id, saturday.id, "published")
    await setEventStatus(db, organizer.id, sunday.id, "published")
    expect(await eventsThisMonth(db, organizer.id)).toBe(2)
    const [friday] = await db.select().from(schema.events).where((await import("drizzle-orm")).eq(schema.events.slug, "friday"))
    await expect(setEventStatus(db, organizer.id, friday.id, "published")).rejects.toBeInstanceOf(PlanLimitError)
    // Back to draft and published again doesn't count twice; a cancelled event stops counting.
    await setEventStatus(db, organizer.id, sunday.id, "draft")
    expect(await eventsThisMonth(db, organizer.id)).toBe(1)
    await setEventStatus(db, organizer.id, sunday.id, "published")
    await setEventStatus(db, organizer.id, sunday.id, "cancelled")
    await setEventStatus(db, organizer.id, saturday.id, "cancelled")
    expect(await eventsThisMonth(db, organizer.id)).toBe(0)
  })

  it("only shows published events publicly", async () => {
    expect(await listPublicEvents(db, organizer.id)).toHaveLength(0)
    expect(await getPublicEvent(db, "esc", "thursday")).toBeNull()
    const [draft] = await db.select().from(schema.events).where((await import("drizzle-orm")).eq(schema.events.slug, "thursday"))
    await setEventStatus(db, organizer.id, draft.id, "published")
    expect(await listPublicEvents(db, organizer.id)).toHaveLength(1)
    expect((await getPublicEvent(db, "esc", "thursday"))?.event.title).toBe("Thursday club")
  })

  it("splits upcoming and past events, and knows when registration closes", async () => {
    const pro = { ...organizer, plan: "pro" as const, planUntil: new Date(Date.now() + 86_400_000) }
    await db.update(schema.organizers).set({ plan: "pro", planUntil: pro.planUntil })
    const soon = await createEvent(db, pro, { ...base, slug: "soon", startsAt: new Date(Date.now() + 3 * 3_600_000), registrationClosesBefore: 720 })
    await setEventStatus(db, organizer.id, soon.id, "published")
    const started = await createEvent(db, pro, { ...base, slug: "started", startsAt: new Date(Date.now() + 60_000) })
    await setEventStatus(db, organizer.id, started.id, "published")
    const later = new Date(Date.now() + 120_000)
    expect((await listPublicEvents(db, organizer.id, later)).map((e) => e.slug)).toContain("soon")
    expect((await listPublicEvents(db, organizer.id, later)).map((e) => e.slug)).not.toContain("started")
    expect((await listPastPublicEvents(db, organizer.id, later)).map((e) => e.slug)).toEqual(["started"])
    // 12 hours before a start 3 hours away: already closed.
    expect(registrationOpen((await getPublicEvent(db, "esc", "soon"))!.event)).toBe(false)
    expect(registrationOpen((await getPublicEvent(db, "esc", "started"))!.event, new Date())).toBe(true)
  })

  it("guards edits and status changes", async () => {
    const [thursday] = await db.select().from(schema.events).where((await import("drizzle-orm")).eq(schema.events.slug, "thursday"))
    await expect(checkEventInput(db, { ...base, startsAt: new Date(Date.now() - 60_000) }, null)).rejects.toMatchObject({ code: "startsInPast" })
    // An unchanged past start is fine when editing (e.g. fixing the description afterwards).
    const past = { ...thursday, startsAt: new Date(Date.now() - 86_400_000) }
    await expect(checkEventInput(db, { ...base, startsAt: past.startsAt }, past)).resolves.toBeUndefined()
    const user = await upsertTelegramUser(db, { id: "9", first_name: "A", auth_date: "1", hash: "" }, "ru")
    await db.insert(schema.registrations).values({ eventId: thursday.id, userId: user.id, name: "A", status: "confirmed", referenceCode: "ESC-1" })
    await expect(checkEventInput(db, { ...base, capacity: 1 }, thursday)).resolves.toBeUndefined()
    await db.insert(schema.registrations).values({ eventId: thursday.id, userId: (await upsertTelegramUser(db, { id: "8", first_name: "B", auth_date: "1", hash: "" }, "ru")).id, name: "B", status: "held", referenceCode: "ESC-2" })
    await expect(checkEventInput(db, { ...base, capacity: 1 }, thursday)).rejects.toMatchObject({ code: "capacityBelowTaken", n: 2 })
    // Thursday is published and has registrations: no going back to draft, no deleting.
    await expect(setEventStatus(db, organizer.id, thursday.id, "draft")).rejects.toBeInstanceOf(EventRuleError)
    const pro = { ...organizer, plan: "pro" as const, planUntil: new Date(Date.now() + 86_400_000) }
    const draft = await createEvent(db, pro, { ...base, slug: "scrap" })
    expect(await deleteDraft(db, organizer.id, draft.id)).toBe(true)
    expect(await deleteDraft(db, organizer.id, thursday.id)).toBe(false)
    const pastDraft = await createEvent(db, pro, { ...base, slug: "old-draft", startsAt: new Date(Date.now() - 3_600_000) })
    await expect(setEventStatus(db, organizer.id, pastDraft.id, "published")).rejects.toMatchObject({ code: "startsInPast" })
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
    // Copies are drafts, so they don't hit the monthly limit until published.
    expect((await duplicateEvent(db, organizer, source.id, now))?.status).toBe("draft")
  })
})
