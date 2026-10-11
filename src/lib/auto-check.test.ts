import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { createEvent, setEventStatus } from "@/lib/events"
import { createOrganizer, updateOrganizer } from "@/lib/organizers"
import { attachReceipt, autoCheckUsage, getReceipt, listEventRegistrations, recordReceiptText, register } from "@/lib/registrations"
import { organizerSchema } from "@/lib/validation"

let db: Db
let organizer: schema.Organizer
let event: schema.Event
const users: schema.User[] = []
const input = { name: "Aziza", phone: "+998901234567", note: "" }

const organizerInput = organizerSchema.parse({
  slug: "esc",
  name: "ESC",
  autoCheck: true,
  autoApprove: true,
  payoutCardLast4: "1234",
  payoutName: "Aziza K.",
})

function receiptText(reg: schema.Registration, date: Date) {
  const d = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)
  return `CLICK\nПлатёж успешно выполнен\nСумма: 50 000.00 сум\nКарта: 8600 **** **** 1234\nДата: ${d.replace(",", "")}\nНомер транзакции: ${reg.referenceCode.replace(/\D/g, "")}00${users.length}\nКомментарий: ${reg.referenceCode}`
}

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
  const owner = await upsertTelegramUser(db, { id: "1", first_name: "Org", auth_date: "1", hash: "" }, "ru")
  organizer = await createOrganizer(db, owner.id, organizerInput)
  for (let i = 2; i <= 4; i++) users.push(await upsertTelegramUser(db, { id: String(i), first_name: `U${i}`, auth_date: "1", hash: "" }, "ru"))
  event = await createEvent(db, organizer, {
    slug: "thu",
    title: "Thursday",
    description: "",
    startsAt: new Date(Date.now() + 7 * 86_400_000),
    endsAt: null,
    venue: "",
    venueUrl: "",
    capacity: 10,
    priceUzs: 50_000,
    paymentInstructions: "card",
    holdMinutes: 30,
  })
  event = (await setEventStatus(db, organizer.id, event.id, "published"))!
})

describe("auto-check", () => {
  it("stores the organizer's auto-check settings", () => {
    expect(organizer.autoCheck).toBe(true)
    expect(organizer.autoApprove).toBe(true)
    expect(organizer.payoutCardLast4).toBe("1234")
    expect(organizerSchema.safeParse({ ...organizerInput, payoutCardLast4: "12" }).success).toBe(false)
  })

  it("confirms a passing receipt without the organizer", async () => {
    const reg = await register(db, event, "esc", users[0].id, input)
    const { receiptId } = await attachReceipt(db, reg.id, "image/jpeg", Buffer.from("receipt-a"))
    const result = await recordReceiptText(db, receiptId, receiptText(reg, new Date()))
    expect(result?.verdict).toBe("pass")
    expect(result?.status).toBe("confirmed")
    const row = (await listEventRegistrations(db, event.id)).find((r) => r.registration.id === reg.id)!
    expect(row.registration.status).toBe("confirmed")
    expect(row.registration.decidedBy).toBeNull()
    expect(row.receipt?.verdict).toBe("pass")
    expect(row.receipt?.amountUzs).toBe(50_000)
    expect(row.receipt?.checks?.reference).toBe("ok")
    expect((await getReceipt(db, receiptId))?.receipt.ocrText).toContain("CLICK")
  })

  it("flags the same screenshot or receipt number used by someone else", async () => {
    const reg = await register(db, event, "esc", users[1].id, input)
    const { receiptId } = await attachReceipt(db, reg.id, "image/jpeg", Buffer.from("receipt-a"))
    const result = await recordReceiptText(db, receiptId, receiptText(reg, new Date()))
    expect(result?.checks.duplicate).toBe("duplicate")
    expect(result?.verdict).toBe("fail")
    expect(result?.status).toBe("proof_sent")
  })

  it("leaves a wrong amount for the organizer and counts checked receipts", async () => {
    const reg = await register(db, event, "esc", users[2].id, input)
    const { receiptId } = await attachReceipt(db, reg.id, "image/jpeg", Buffer.from("receipt-c"))
    const result = await recordReceiptText(db, receiptId, receiptText(reg, new Date()).replace("50 000.00", "40 000.00"))
    expect(result?.verdict).toBe("fail")
    expect(result?.checks.amount).toBe("mismatch")
    expect(result?.status).toBe("proof_sent")
    expect(await autoCheckUsage(db, organizer.id, new Date(Date.now() - 60_000))).toBe(3)
  })

  it("does nothing when the add-on is off", async () => {
    organizer = await updateOrganizer(db, organizer.id, { ...organizerInput, autoCheck: false })
    const reg = await register(db, event, "esc", (await upsertTelegramUser(db, { id: "9", first_name: "U9", auth_date: "1", hash: "" }, "ru")).id, input)
    const { receiptId } = await attachReceipt(db, reg.id, "image/jpeg", Buffer.from("receipt-d"))
    expect(await recordReceiptText(db, receiptId, receiptText(reg, new Date()))).toBeNull()
    expect(await autoCheckUsage(db, organizer.id, new Date(Date.now() - 60_000))).toBe(3)
  })
})
