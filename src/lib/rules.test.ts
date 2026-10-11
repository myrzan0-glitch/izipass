import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { createEvent, setEventStatus } from "@/lib/events"
import { createOrganizer } from "@/lib/organizers"
import { attachReceipt, checkIn, expireHolds, register } from "@/lib/registrations"
import type { TelegramApi } from "@/lib/telegram/api"
import { notifyAttendees, notifyEventCancelled, notifyEventChanged } from "@/lib/telegram/bot"
import { organizerSchema, type EventInput } from "@/lib/validation"

let db: Db
let organizer: schema.Organizer
let owner: schema.User
const people: schema.User[] = []
const input = { name: "A", phone: "+998901234567", note: "" }
const base: EventInput = {
  slug: "x", title: "X", description: "", startsAt: new Date(Date.now() + 7 * 86_400_000), endsAt: null, venue: "", venueUrl: "",
  capacity: 1, priceUzs: 50_000, paymentTo: "", paymentInstructions: "card", holdMinutes: 30, registrationClosesBefore: 0,
}

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
  owner = await upsertTelegramUser(db, { id: "1", first_name: "Org", auth_date: "1", hash: "" }, "ru")
  organizer = await createOrganizer(db, owner.id, organizerSchema.parse({ slug: "esc", name: "ESC" }))
  await db.update(schema.organizers).set({ plan: "pro", planUntil: new Date(Date.now() + 86_400_000) })
  organizer = (await db.select().from(schema.organizers))[0]
  for (let i = 2; i <= 5; i++) people.push(await upsertTelegramUser(db, { id: String(i), first_name: `U${i}`, auth_date: "1", hash: "" }, "ru"))
})

async function published(over: Partial<EventInput>) {
  const e = await createEvent(db, organizer, { ...base, ...over })
  return (await setEventStatus(db, organizer.id, e.id, "published"))!
}

describe("registration rules", () => {
  it("doesn't let the organizer take a spot at their own event", async () => {
    const event = await published({ slug: "own" })
    await expect(register(db, event, "esc", owner.id, input)).rejects.toMatchObject({ code: "organizer" })
  })

  it("closes at the organizer's deadline, and the waitlist closes with it", async () => {
    const startsAt = new Date(Date.now() + 2 * 86_400_000)
    const event = await published({ slug: "deadline", startsAt, registrationClosesBefore: 1440 })
    const held = await register(db, event, "esc", people[0].id, input)
    const waiting = await register(db, event, "esc", people[1].id, input)
    expect([held.status, waiting.status]).toEqual(["held", "waitlist"])
    const afterDeadline = new Date(startsAt.getTime() - 60 * 60_000)
    await expect(register(db, event, "esc", people[2].id, input, afterDeadline)).rejects.toMatchObject({ code: "closed" })
    await expireHolds(db, event.id, afterDeadline)
    const rows = Object.fromEntries((await db.select().from(schema.registrations).where(eq(schema.registrations.eventId, event.id))).map((r) => [r.userId, r.status]))
    // The unpaid hold expired; nobody moved up after the deadline, and the waitlist closed.
    expect(rows[people[0].id]).toBe("expired")
    expect(rows[people[1].id]).toBe("expired")
  })

  it("stops receipts and check-ins once the event is cancelled", async () => {
    const event = await published({ slug: "cancel", capacity: 5 })
    const a = await register(db, event, "esc", people[0].id, input)
    const b = await register(db, event, "esc", people[1].id, input)
    await db.update(schema.registrations).set({ status: "confirmed" }).where(eq(schema.registrations.id, b.id))
    await setEventStatus(db, organizer.id, event.id, "cancelled")
    await expect(attachReceipt(db, a.id, "image/jpeg", Buffer.from("x"))).rejects.toMatchObject({ code: "closed" })
    await expect(checkIn(db, event.id, b.id, owner.id)).rejects.toMatchObject({ code: "cancelled" })
  })

  it("tells people when the waitlist closes, the event is cancelled or changed", async () => {
    process.env.SESSION_SECRET ??= "0123456789abcdef0123456789abcdef"
    const sent: { chat_id: unknown; text: string }[] = []
    const api: TelegramApi = async (_method, params) => {
      sent.push({ chat_id: params.chat_id, text: String(params.text) })
      return {}
    }
    const ctx = { db, api, siteUrl: "https://izipass.test" }
    const startsAt = new Date(Date.now() + 2 * 86_400_000)
    const event = await published({ slug: "notify", startsAt, registrationClosesBefore: 60 })
    await register(db, event, "esc", people[2].id, input)
    await register(db, event, "esc", people[3].id, input) // waitlisted (1 spot)
    await expireHolds(db, event.id, new Date(startsAt.getTime() - 30 * 60_000))
    await notifyAttendees(ctx, event.id)
    expect(sent.find((m) => m.chat_id === "5")?.text).toContain("Запись на «X» закрыта")
    expect(sent.find((m) => m.chat_id === "4")?.text).toContain("Время на оплату")

    sent.length = 0
    const live = await published({ slug: "live", capacity: 5, venue: "Cafe" })
    await register(db, live, "esc", people[0].id, input)
    await register(db, live, "esc", people[1].id, input)
    expect(await notifyEventChanged(ctx, live.id)).toBe(2)
    expect(sent[0].text).toContain("Изменения в «X»")
    expect(sent[0].text).toContain("Cafe")
    await setEventStatus(db, organizer.id, live.id, "cancelled")
    expect(await notifyEventCancelled(ctx, live.id)).toBe(2)
    expect(sent.at(-1)?.text).toContain("отменено")
  })
})
