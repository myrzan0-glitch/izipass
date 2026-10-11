import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { AccountLinkError, consumeLoginToken, deleteAccount, getUser, issueLoginToken, linkTelegram, upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { createEvent, listEventsForOrganizers } from "@/lib/events"
import { createOrganizer, createOrganizerFromName, getEventForMember, getMemberOrganizer, listOrganizersForUser } from "@/lib/organizers"
import { organizerSchema, profileSchema, type EventInput } from "@/lib/validation"

let db: Db

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
})

const tg = (id: string, name: string) => ({ id, first_name: name, auth_date: "1", hash: "" })
const event = (slug: string): EventInput => ({
  slug,
  title: "Club",
  description: "",
  startsAt: new Date(Date.now() + 86_400_000),
  endsAt: null,
  venue: "",
  venueUrl: "",
  capacity: 10,
  priceUzs: 0,
  paymentInstructions: "",
  holdMinutes: 30,
  registrationClosesBefore: 0,
})

describe("organizations", () => {
  it("lets a person run several organizations and reach only their events", async () => {
    const malika = await upsertTelegramUser(db, tg("100", "Malika"), "en")
    const other = await upsertTelegramUser(db, tg("101", "Other"), "en")
    const first = await createOrganizer(db, malika.id, organizerSchema.parse({ slug: "first-club", name: "First" }))
    const second = await createOrganizer(db, malika.id, organizerSchema.parse({ slug: "second-club", name: "Second" }))
    const theirs = await createOrganizer(db, other.id, organizerSchema.parse({ slug: "their-club", name: "Theirs" }))

    expect((await listOrganizersForUser(db, malika.id)).map((m) => [m.organizer.slug, m.role])).toEqual([
      ["first-club", "owner"],
      ["second-club", "owner"],
    ])
    expect(await getMemberOrganizer(db, malika.id, second.id)).toMatchObject({ id: second.id })
    expect(await getMemberOrganizer(db, malika.id, theirs.id)).toBeNull()
    expect(await getMemberOrganizer(db, malika.id, "not-a-uuid")).toBeNull()

    const mine = await createEvent(db, second, event("weekly"))
    const notMine = await createEvent(db, theirs, event("weekly"))
    expect((await getEventForMember(db, malika.id, mine.id))?.organizer.id).toBe(second.id)
    expect(await getEventForMember(db, malika.id, notMine.id)).toBeNull()
    expect((await listEventsForOrganizers(db, [first.id, second.id])).map((r) => r.event.id)).toEqual([mine.id])
  })

  it("makes a first organization from a name, numbering taken addresses", async () => {
    const a = await upsertTelegramUser(db, tg("102", "A"), "en")
    const b = await upsertTelegramUser(db, tg("103", "B"), "en")
    expect((await createOrganizerFromName(db, a.id, "Book Club")).slug).toBe("book-club")
    expect((await createOrganizerFromName(db, b.id, "Book Club")).slug).toBe("book-club-2")
    // A reserved word as the name still gets an address.
    expect((await createOrganizerFromName(db, b.id, "Dashboard")).slug).toBe("dashboard-2")
  })
})

describe("account", () => {
  it("adds an email to the signed-in account, unless someone else has it", async () => {
    const user = await upsertTelegramUser(db, tg("200", "Dilnoza"), "ru")
    const { token } = await issueLoginToken(db, "Dilnoza@Example.com", "/ru/dashboard/settings", user.id)
    const result = await consumeLoginToken(db, token, "ru")
    expect(result?.user.id).toBe(user.id)
    expect((await getUser(db, user.id))?.email).toBe("dilnoza@example.com")

    const someone = await upsertTelegramUser(db, tg("201", "Someone"), "ru")
    const taken = await issueLoginToken(db, "dilnoza@example.com", null, someone.id)
    await expect(consumeLoginToken(db, taken.token, "ru")).rejects.toBeInstanceOf(AccountLinkError)
  })

  it("connects Telegram to an email account, unless it's linked elsewhere", async () => {
    const { token } = await issueLoginToken(db, "bobur@example.com", null)
    const user = (await consumeLoginToken(db, token, "uz"))!.user
    const linked = await linkTelegram(db, user.id, { ...tg("300", "Bobur"), username: "bobur" })
    expect(linked).toMatchObject({ telegramId: "300", telegramUsername: "bobur" })
    await expect(linkTelegram(db, user.id, tg("200", "Dilnoza"))).rejects.toBeInstanceOf(AccountLinkError)
  })

  it("deletes a guest's account but not an organization owner's", async () => {
    const guest = await upsertTelegramUser(db, tg("400", "Guest"), "en")
    expect(await deleteAccount(db, guest.id)).toBe(true)
    expect(await getUser(db, guest.id)).toBeNull()

    const owner = await upsertTelegramUser(db, tg("401", "Owner"), "en")
    await createOrganizer(db, owner.id, organizerSchema.parse({ slug: "owned-club", name: "Owned" }))
    expect(await deleteAccount(db, owner.id)).toBe(false)
    expect(await getUser(db, owner.id)).not.toBeNull()
  })

  it("accepts an empty phone in the profile, and normalizes a real one", () => {
    expect(profileSchema.parse({ name: "Aziza", phone: "", locale: "uz" }).phone).toBe("")
    expect(profileSchema.parse({ name: "Aziza", phone: "+998 (90) 123-45-67", locale: "uz" }).phone).toBe("+998901234567")
    expect(profileSchema.safeParse({ name: "Aziza", phone: "12", locale: "uz" }).success).toBe(false)
    expect(profileSchema.safeParse({ name: "Aziza", phone: "", locale: "de" }).success).toBe(false)
  })
})
