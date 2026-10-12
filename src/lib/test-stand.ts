import { createHash } from "node:crypto"
import { eq, inArray, like, sql } from "drizzle-orm"

import type { Db } from "@/lib/db"
import { events, organizerMembers, organizers, receipts, registrations, users } from "@/lib/db/schema"
import { TEST_RECEIPT_PNG } from "@/lib/test-stand-receipt"

/**
 * The test stand (test.izipass.myrzan.com) runs the same code as production with TEST_STAND=1:
 * emails are never sent (the sign-in link is shown on screen), and ready-made accounts sign in
 * with one click. Never set TEST_STAND on production; the production domain refuses it anyway.
 */
export function isTestStand() {
  if (process.env.TEST_STAND !== "1") return false
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? ""
  return !/^https:\/\/izipass\.myrzan\.com\/?$/.test(site)
}

/** `.test` is a reserved domain: these addresses can never receive mail. */
const DOMAIN = "izipass.test"

export const TEST_ACCOUNTS = [
  { key: "organizer", email: `organizer@${DOMAIN}`, name: "Sardor Tursunov", phone: "+998 90 100 00 01" },
  { key: "alina", email: `alina@${DOMAIN}`, name: "Alina Karimova", phone: "+998 90 100 00 02" },
  { key: "bobur", email: `bobur@${DOMAIN}`, name: "Bobur Rakhimov", phone: "+998 90 100 00 03" },
  { key: "dilnoza", email: `dilnoza@${DOMAIN}`, name: "Dilnoza Yusupova", phone: "+998 90 100 00 04" },
] as const

export type TestAccountKey = (typeof TEST_ACCOUNTS)[number]["key"]

export const TEST_ORGANIZER_SLUG = "test-club"

const DAY = 86_400_000

/**
 * The next `weekday` (0 = Sunday) at least `minDays` from today, at `hour`:00 Tashkent time (UTC+5),
 * so "Thursday speaking club" really falls on a Thursday. Negative `minDays` looks back instead.
 */
function on(weekday: number, hour: number, minDays: number) {
  const date = new Date(Date.now() + minDays * DAY)
  const step = minDays < 0 ? -1 : 1
  while (date.getUTCDay() !== weekday) date.setTime(date.getTime() + step * DAY)
  date.setUTCHours(hour - 5, 0, 0, 0)
  return date
}

/** Removes every test account and every organization a test account belongs to (with their events). */
async function wipe(db: Db) {
  const testUsers = await db.select({ id: users.id }).from(users).where(like(users.email, `%@${DOMAIN}`))
  const ids = testUsers.map((u) => u.id)
  if (ids.length) {
    const orgs = await db
      .selectDistinct({ id: organizerMembers.organizerId })
      .from(organizerMembers)
      .where(inArray(organizerMembers.userId, ids))
    if (orgs.length) await db.delete(organizers).where(inArray(organizers.id, orgs.map((o) => o.id)))
    await db.delete(users).where(inArray(users.id, ids))
  }
  await db.delete(organizers).where(eq(organizers.slug, TEST_ORGANIZER_SLUG))
}

/**
 * Creates the test accounts and the Test Club with its events, unless they already exist.
 * With `reset`, everything the test accounts made is deleted first and seeded again.
 */
export async function seedTestStand(db: Db, { reset = false } = {}) {
  if (reset) await wipe(db)
  else {
    const [existing] = await db.select({ id: organizers.id }).from(organizers).where(eq(organizers.slug, TEST_ORGANIZER_SLUG)).limit(1)
    if (existing) return
  }

  const people: Record<TestAccountKey, string> = { organizer: "", alina: "", bobur: "", dilnoza: "" }
  for (const account of TEST_ACCOUNTS) {
    const [found] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${account.email}`).limit(1)
    const [user] = found
      ? [found]
      : await db
          .insert(users)
          .values({ email: account.email, name: account.name, phone: account.phone, locale: "ru" })
          .returning({ id: users.id })
    people[account.key] = user.id
  }

  const [club] = await db
    .insert(organizers)
    .values({
      slug: TEST_ORGANIZER_SLUG,
      name: "izipass Test Club",
      description: "Test organization on the test stand: speaking clubs, runs and workshops. Nothing here is real.",
      links: ["https://t.me/izipass_bot"],
      // Pro, so the organizer can publish more test events this month.
      plan: "pro",
      planUntil: new Date(Date.now() + 3650 * DAY),
      payoutCardLast4: "9012",
      payoutName: "Sardor T.",
    })
    .returning({ id: organizers.id })
  await db.insert(organizerMembers).values({ organizerId: club.id, userId: people.organizer, role: "owner" })

  const paid = { paymentTo: "8600 1234 5678 9012", paymentInstructions: "Sardor T. Put your code (e.g. TES-2002) in the comment." }
  const now = new Date()
  const seeded = await db
    .insert(events)
    .values([
      {
        organizerId: club.id,
        slug: "speaking-club",
        title: "Thursday speaking club",
        description: "Travel stories in English. Bring one photo from a trip and tell us about it.",
        startsAt: on(4, 19, 3),
        endsAt: on(4, 21, 3),
        venue: "Bon! cafe, Mirabad",
        capacity: 20,
        priceUzs: 50_000,
        ...paid,
        // A day to pay, so the "waiting for payment" registration doesn't expire mid-test.
        holdMinutes: 1440,
        status: "published" as const,
        publishedAt: now,
      },
      {
        organizerId: club.id,
        slug: "morning-run",
        title: "Sunrise 5K",
        description: "An easy 5 km around Magic City. Free; just register so we know how many to expect.",
        startsAt: on(6, 7, 1),
        venue: "Magic City, main entrance",
        capacity: 30,
        status: "published" as const,
        publishedAt: now,
      },
      {
        organizerId: club.id,
        slug: "clay-workshop",
        title: "Clay workshop",
        description: "Two seats only, both taken: register to try the waitlist.",
        startsAt: on(0, 11, 10),
        endsAt: on(0, 13, 10),
        venue: "Kids Art Studio",
        capacity: 2,
        priceUzs: 120_000,
        ...paid,
        status: "published" as const,
        publishedAt: now,
      },
      {
        organizerId: club.id,
        slug: "startup-breakfast",
        title: "Startup breakfast (draft)",
        description: "Not published yet: only the organizer sees it.",
        startsAt: on(5, 9, 14),
        venue: "IT Park",
        capacity: 40,
        status: "draft" as const,
      },
      {
        organizerId: club.id,
        slug: "orwell-night",
        title: "Orwell night",
        description: "A past event: one guest checked in, one didn't come.",
        startsAt: on(3, 19, -6),
        venue: "Bookmark Café",
        capacity: 15,
        priceUzs: 40_000,
        ...paid,
        status: "published" as const,
        publishedAt: new Date(Date.now() - 14 * DAY),
      },
    ])
    .returning({ id: events.id, slug: events.slug })
  const event = Object.fromEntries(seeded.map((e) => [e.slug, e.id]))

  let code = 1000
  const reg = (slug: string, who: TestAccountKey, status: "held" | "proof_sent" | "confirmed", extra: Partial<typeof registrations.$inferInsert> = {}) => {
    const account = TEST_ACCOUNTS.find((a) => a.key === who)!
    code += 1
    return {
      eventId: event[slug],
      userId: people[who],
      name: account.name,
      phone: account.phone,
      status,
      referenceCode: `TES-${code}`,
      // Nothing to tell them: the test accounts have no Telegram.
      notifiedStatus: status,
      ...(status === "confirmed" ? { decidedAt: now, decidedBy: people.organizer } : {}),
      ...extra,
    }
  }
  const regs = await db
    .insert(registrations)
    .values([
      reg("speaking-club", "alina", "confirmed"),
      reg("speaking-club", "bobur", "proof_sent", { referenceCode: "TES-2002" }),
      reg("speaking-club", "dilnoza", "held", { holdExpiresAt: new Date(Date.now() + DAY) }),
      reg("morning-run", "alina", "confirmed"),
      reg("morning-run", "bobur", "confirmed"),
      reg("clay-workshop", "alina", "confirmed"),
      reg("clay-workshop", "bobur", "confirmed"),
      reg("orwell-night", "alina", "confirmed", { checkedInAt: on(3, 19, -6), checkedInBy: people.organizer }),
      reg("orwell-night", "bobur", "confirmed"),
    ])
    .returning({ id: registrations.id, status: registrations.status })

  const image = Buffer.from(TEST_RECEIPT_PNG, "base64")
  const proof = regs.find((r) => r.status === "proof_sent")!
  await db.insert(receipts).values({
    registrationId: proof.id,
    contentType: "image/png",
    data: image,
    sha256: createHash("sha256").update(image).digest("hex"),
  })
}
