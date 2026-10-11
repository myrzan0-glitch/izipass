import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { createEvent } from "@/lib/events"
import { absoluteImageUrl, getImage, imageIdFromUrl, setCover, setLogo } from "@/lib/images"
import { describeLink } from "@/lib/links"
import { createOrganizer } from "@/lib/organizers"
import { organizerSchema } from "@/lib/validation"

let db: Db
let a: schema.Organizer
let b: schema.Organizer
let event: schema.Event
const png = (s: string) => ({ contentType: "image/png", data: Buffer.from(s) })

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
  const u1 = await upsertTelegramUser(db, { id: "1", first_name: "A", auth_date: "1", hash: "" }, "ru")
  const u2 = await upsertTelegramUser(db, { id: "2", first_name: "B", auth_date: "1", hash: "" }, "ru")
  a = await createOrganizer(db, u1.id, organizerSchema.parse({ slug: "aaa", name: "AAA" }))
  b = await createOrganizer(db, u2.id, organizerSchema.parse({ slug: "bbb", name: "BBB" }))
  event = await createEvent(db, a, {
    slug: "e", title: "E", description: "", startsAt: new Date(Date.now() + 86_400_000), endsAt: null,
    venue: "", venueUrl: "", capacity: 10, priceUzs: 0, paymentInstructions: "", holdMinutes: 30,
  })
})

describe("images", () => {
  it("replaces a logo and deletes the old image", async () => {
    const first = (await setLogo(db, a.id, png("one")))!.url!
    const second = (await setLogo(db, a.id, png("two")))!.url!
    expect(first).not.toBe(second)
    expect(await getImage(db, imageIdFromUrl(first)!)).toBeNull()
    expect((await getImage(db, imageIdFromUrl(second)!))?.data.toString()).toBe("two")
    expect((await setLogo(db, a.id, null))!.url).toBeNull()
    expect(await getImage(db, imageIdFromUrl(second)!)).toBeNull()
  })

  it("sets a cover only on the organizer's own event", async () => {
    expect(await setCover(db, b.id, event.id, png("x"))).toBeNull()
    const { url } = (await setCover(db, a.id, event.id, png("cover")))!
    expect(url).toMatch(/^\/api\/images\/[0-9a-f-]{36}$/)
    expect(absoluteImageUrl(url, "https://izipass.test")).toBe(`https://izipass.test${url}`)
    expect(absoluteImageUrl("https://cdn.test/x.png", "https://izipass.test")).toBe("https://cdn.test/x.png")
    expect(imageIdFromUrl("/api/images/not-an-id")).toBeNull()
  })
})

describe("describeLink", () => {
  it("names social links by handle", () => {
    expect(describeLink("https://t.me/esc_tashkent")).toEqual({ kind: "telegram", label: "@esc_tashkent" })
    expect(describeLink("https://www.instagram.com/esc_tashkent/")).toEqual({ kind: "instagram", label: "@esc_tashkent" })
    expect(describeLink("https://youtube.com/@escclub")).toEqual({ kind: "youtube", label: "@escclub" })
    expect(describeLink("https://club.uz/")).toEqual({ kind: "web", label: "club.uz" })
    expect(describeLink("https://club.uz/about/")).toEqual({ kind: "web", label: "club.uz/about" })
  })
})
