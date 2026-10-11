import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { createEvent, setEventStatus } from "@/lib/events"
import { createOrganizer } from "@/lib/organizers"
import { organizerSchema } from "@/lib/validation"
import {
  CheckInError,
  RegistrationError,
  activeCount,
  checkIn,
  undoCheckIn,
  attachReceipt,
  cancelRegistration,
  decide,
  expireHolds,
  getReceipt,
  listEventRegistrations,
  purgeOldReceipts,
  referenceCode,
  register,
} from "@/lib/registrations"

let db: Db
let organizer: schema.Organizer
let event: schema.Event
let owner: schema.User
const users: schema.User[] = []
const input = { name: "Aziza", phone: "+998901234567", note: "" }

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
  owner = await upsertTelegramUser(db, { id: "1", first_name: "Org", auth_date: "1", hash: "" }, "ru")
  organizer = await createOrganizer(db, owner.id, organizerSchema.parse({ slug: "esc", name: "ESC" }))
  for (let i = 2; i < 8; i++) users.push(await upsertTelegramUser(db, { id: String(i), first_name: `U${i}`, auth_date: "1", hash: "" }, "ru"))
  event = await createEvent(db, organizer, {
    slug: "thu",
    title: "Thu",
    description: "",
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: null,
    venue: "",
    venueUrl: "",
    capacity: 2,
    priceUzs: 100_000,
    paymentInstructions: "Click",
    holdMinutes: 30,
    registrationClosesBefore: 0,
  })
})

describe("registrations", () => {
  it("makes reference codes from the organizer slug", () => {
    expect(referenceCode("english-speaking-club")).toMatch(/^ENG-\d{4}$/)
    expect(referenceCode("123")).toMatch(/^IZI-\d{4}$/)
  })

  it("refuses unpublished events", async () => {
    await expect(register(db, event, "esc", users[0].id, input)).rejects.toMatchObject({ code: "closed" })
    event = (await setEventStatus(db, organizer.id, event.id, "published"))!
  })

  it("holds spots, then waitlists when full", async () => {
    const a = await register(db, event, "esc", users[0].id, input)
    expect(a.status).toBe("held")
    expect(a.holdExpiresAt!.getTime()).toBeGreaterThan(Date.now())
    await expect(register(db, event, "esc", users[0].id, input)).rejects.toMatchObject({ code: "already" })
    const b = await register(db, event, "esc", users[1].id, input)
    expect(b.status).toBe("held")
    const c = await register(db, event, "esc", users[2].id, input)
    expect(c.status).toBe("waitlist")
    expect(await activeCount(db, event.id)).toBe(2)
  })

  it("expires an unpaid hold and promotes the waitlist", async () => {
    const future = new Date(Date.now() + 31 * 60_000)
    expect(await expireHolds(db, event.id, future)).toBe(2)
    const rows = await listEventRegistrations(db, event.id)
    const byUser = Object.fromEntries(rows.map((r) => [r.registration.userId, r.registration.status]))
    expect(byUser[users[0].id]).toBe("expired")
    expect(byUser[users[1].id]).toBe("expired")
    expect(byUser[users[2].id]).toBe("held")
  })

  it("lets an expired attendee register again", async () => {
    const again = await register(db, event, "esc", users[0].id, input)
    expect(again.status).toBe("held")
  })

  it("accepts a receipt, then the organizer decides", async () => {
    const rows = await listEventRegistrations(db, event.id)
    const held = rows.find((r) => r.registration.userId === users[2].id)!.registration
    const { registration: sent } = await attachReceipt(db, held.id, "image/jpeg", Buffer.from("jpg"))
    expect(sent.status).toBe("proof_sent")
    const withReceipt = (await listEventRegistrations(db, event.id)).find((r) => r.registration.id === held.id)!
    expect(withReceipt.receiptId).toBeTruthy()
    expect((await getReceipt(db, withReceipt.receiptId!))?.receipt.data.toString()).toBe("jpg")

    const confirmed = await decide(db, event.id, held.id, "confirmed", owner.id)
    expect(confirmed.status).toBe("confirmed")
    expect(confirmed.decidedBy).toBe(owner.id)
  })

  it("rejecting frees the spot for the waitlist", async () => {
    const waiting = await register(db, event, "esc", users[3].id, input)
    expect(waiting.status).toBe("waitlist")
    const rows = await listEventRegistrations(db, event.id)
    const held = rows.find((r) => r.registration.userId === users[0].id)!.registration
    const rejected = await decide(db, event.id, held.id, "rejected", owner.id, "Wrong amount")
    expect(rejected.rejectReason).toBe("Wrong amount")
    const after = await listEventRegistrations(db, event.id)
    expect(after.find((r) => r.registration.userId === users[3].id)!.registration.status).toBe("held")
  })

  it("rejected attendees register again (to the waitlist when full)", async () => {
    const rows = await listEventRegistrations(db, event.id)
    const rejected = rows.find((r) => r.registration.userId === users[0].id)!.registration
    await expect(attachReceipt(db, rejected.id, "image/png", Buffer.from("png"))).rejects.toMatchObject({ code: "badState" })
    expect((await register(db, event, "esc", users[0].id, input)).status).toBe("waitlist")
  })

  it("cancelling promotes the earliest waitlisted and blocks other users", async () => {
    const waiting = await register(db, event, "esc", users[4].id, input)
    expect(waiting.status).toBe("waitlist")
    const rows = await listEventRegistrations(db, event.id)
    const mine = rows.find((r) => r.registration.userId === users[3].id)!.registration
    await expect(cancelRegistration(db, mine.id, users[0].id)).rejects.toBeInstanceOf(RegistrationError)
    await cancelRegistration(db, mine.id, users[3].id)
    const after = Object.fromEntries((await listEventRegistrations(db, event.id)).map((r) => [r.registration.userId, r.registration.status]))
    expect(after[users[0].id]).toBe("held")
    expect(after[users[4].id]).toBe("waitlist")
    expect(await activeCount(db, event.id)).toBe(2)
  })

  it("purges receipts a month after the event", async () => {
    expect(await purgeOldReceipts(db)).toBe(0)
    expect(await purgeOldReceipts(db, new Date(Date.now() + 40 * 86_400_000))).toBe(1)
  })
})

describe("check-in", () => {
  it("checks in confirmed attendees once, rejects the rest", async () => {
    const rows = await listEventRegistrations(db, event.id)
    const confirmed = rows.find((r) => r.registration.status === "confirmed")!.registration
    const first = await checkIn(db, event.id, confirmed.id, owner.id)
    expect(first.already).toBe(false)
    expect(first.registration.checkedInBy).toBe(owner.id)
    const second = await checkIn(db, event.id, confirmed.id, owner.id)
    expect(second.already).toBe(true)
    expect(second.registration.checkedInAt?.getTime()).toBe(first.registration.checkedInAt?.getTime())

    const held = rows.find((r) => r.registration.status === "held")!.registration
    await expect(checkIn(db, event.id, held.id, owner.id)).rejects.toMatchObject({ code: "notConfirmed" })
    await expect(checkIn(db, "00000000-0000-0000-0000-000000000000", confirmed.id, owner.id)).rejects.toBeInstanceOf(CheckInError)

    expect((await undoCheckIn(db, event.id, confirmed.id))?.checkedInAt).toBeNull()
  })
})
