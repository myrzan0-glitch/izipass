import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { upsertTelegramUser } from "@/lib/auth/users"
import type { Db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { createEvent, setEventStatus } from "@/lib/events"
import { createOrganizer } from "@/lib/organizers"
import { attachReceipt, decide, expireHolds, getRegistration, register } from "@/lib/registrations"
import { createTelegramApi, webhookSecret, type TelegramApi } from "@/lib/telegram/api"
import { handleUpdate, notifyAttendees, notifyPendingReceipts, notifyReceipt } from "@/lib/telegram/bot"
import { organizerSchema } from "@/lib/validation"

process.env.SESSION_SECRET ??= "0123456789abcdef0123456789abcdef"

type Call = { method: string; params: Record<string, unknown>; file?: boolean }
let calls: Call[] = []
const api: TelegramApi = async (method, params, file) => {
  calls.push({ method, params, file: !!file })
  return { message_id: 1 }
}

let db: Db
let ctx: { db: Db; api: TelegramApi; siteUrl: string }
let organizer: schema.Organizer
let event: schema.Event
let owner: schema.User
const people: schema.User[] = []
const input = { name: "Aziza", phone: "+998901234567", note: "" }
const tg = (id: number, first: string, locale = "ru") =>
  upsertTelegramUser(db, { id: String(id), first_name: first, auth_date: "1", hash: "" }, locale)

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema })
  await migrate(pg, { migrationsFolder: "./drizzle" })
  db = pg as unknown as Db
  ctx = { db, api, siteUrl: "https://izipass.test" }
  owner = await tg(1, "Malika", "en")
  organizer = await createOrganizer(db, owner.id, organizerSchema.parse({ slug: "esc", name: "ESC" }))
  for (const [id, name] of [[2, "Aziza"], [3, "Bobur"], [4, "Dilnoza"]] as const) people.push(await tg(id, name))
  event = await createEvent(db, organizer, {
    slug: "thu",
    title: "Thursday club",
    description: "",
    startsAt: new Date(Date.now() + 7 * 86_400_000),
    endsAt: null,
    venue: "",
    venueUrl: "",
    capacity: 1,
    priceUzs: 50_000,
    paymentInstructions: "card",
    holdMinutes: 30,
    registrationClosesBefore: 0,
  })
  event = (await setEventStatus(db, organizer.id, event.id, "published"))!
})

beforeEach(() => {
  calls = []
})

const press = (from: schema.User, data: string, caption = "🧾 New receipt") =>
  handleUpdate(ctx, {
    update_id: 1,
    callback_query: { id: "q", from: { id: Number(from.telegramId) }, data, message: { message_id: 7, chat: { id: 1 }, caption, photo: [{}] } },
  })

describe("telegram bot", () => {
  it("derives a stable webhook secret Telegram accepts", () => {
    expect(webhookSecret("123:abc")).toBe(webhookSecret("123:abc"))
    expect(webhookSecret("123:abc")).not.toBe(webhookSecret("123:abd"))
    expect(webhookSecret("123:abc")).toMatch(/^[A-Za-z0-9_-]{1,256}$/)
  })

  it("sends the organizer the receipt photo with buttons, once", async () => {
    const reg = await register(db, event, "esc", people[0].id, input)
    const { receiptId } = await attachReceipt(db, reg.id, "image/jpeg", Buffer.from("jpg"))
    expect(await notifyReceipt(ctx, receiptId)).toBe(1)
    expect(await notifyReceipt(ctx, receiptId)).toBeNull()
    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call.method).toBe("sendPhoto")
    expect(call.file).toBe(true)
    expect(call.params.chat_id).toBe("1")
    expect(call.params.caption).toContain("Thursday club")
    expect(call.params.caption).toContain(reg.referenceCode)
    const keyboard = (call.params.reply_markup as { inline_keyboard: { callback_data?: string; url?: string }[][] }).inline_keyboard
    expect(keyboard[0].map((b) => b.callback_data)).toEqual([`a:${reg.id}`, `x:${reg.id}`])
    expect(keyboard[1][0].url).toBe(`https://izipass.test/en/dashboard/events/${event.id}/registrations`)
  })

  it("approves from the button and sends the attendee their ticket", async () => {
    const reg = (await getRegistration(db, (await db.select().from(schema.registrations))[0].id))!.registration
    await press(owner, `a:${reg.id}`)
    expect((await getRegistration(db, reg.id))!.registration.status).toBe("confirmed")
    expect(calls.map((c) => c.method)).toEqual(["editMessageCaption", "answerCallbackQuery", "sendMessage"])
    expect(calls[0].params.caption).toContain("Approved by Malika")
    const ticket = calls[2]
    expect(ticket.params.chat_id).toBe("2")
    expect(ticket.params.text).toContain("Thursday club")
    expect(JSON.stringify(ticket.params.reply_markup)).toContain(`https://izipass.test/ru/r/${reg.id}`)
    // Told once only.
    expect(await notifyAttendees(ctx, event.id)).toBe(0)
  })

  it("refuses buttons from someone outside the team or not signed in", async () => {
    const waiting = await register(db, event, "esc", people[1].id, input)
    expect(waiting.status).toBe("waitlist")
    await press(people[2], `a:${waiting.id}`)
    expect(calls.at(-1)?.method).toBe("answerCallbackQuery")
    expect(calls.at(-1)?.params.text).toBe("Вы не организатор этого мероприятия.")
    await handleUpdate(ctx, { update_id: 2, callback_query: { id: "q", from: { id: 999, language_code: "en" }, data: `a:${waiting.id}`, message: { message_id: 7, chat: { id: 999 } } } })
    expect(calls.at(-1)?.params.text).toBe("Sign in to izipass with this Telegram account first.")
    expect((await getRegistration(db, waiting.id))!.registration.status).toBe("waitlist")
  })

  it("rejects only after a second tap; the waitlist then gets the spot and a message", async () => {
    const confirmed = (await db.select().from(schema.registrations)).find((r) => r.userId === people[0].id)!
    // Already decided: no change, buttons removed.
    await press(owner, `x:${confirmed.id}`)
    expect(calls.map((c) => c.method)).toEqual(["editMessageReplyMarkup", "answerCallbackQuery"])
    expect(calls[1].params.text).toBe("Already decided: Confirmed")

    // The organizer rejects a confirmed one from the dashboard; Bobur moves up from the waitlist.
    calls = []
    await decide(db, event.id, confirmed.id, "rejected", owner.id, "No transfer found")
    expect(await notifyAttendees(ctx, event.id)).toBe(2)
    const texts = Object.fromEntries(calls.map((c) => [c.params.chat_id, String(c.params.text)]))
    expect(texts["2"]).toContain("Причина: No transfer found")
    expect(texts["3"]).toContain("Освободилось место")

    // Bobur pays; the organizer taps Reject, then confirms.
    const bobur = (await db.select().from(schema.registrations)).find((r) => r.userId === people[1].id)!
    const { receiptId } = await attachReceipt(db, bobur.id, "image/png", Buffer.from("png"))
    await notifyReceipt(ctx, receiptId)
    calls = []
    await press(owner, `x:${bobur.id}`)
    expect(calls[0].method).toBe("editMessageReplyMarkup")
    expect(JSON.stringify(calls[0].params.reply_markup)).toContain(`X:${bobur.id}`)
    expect((await getRegistration(db, bobur.id))!.registration.status).toBe("proof_sent")
    await press(owner, `b:${bobur.id}`)
    expect(JSON.stringify(calls.at(-2)?.params.reply_markup)).toContain(`a:${bobur.id}`)
    calls = []
    await press(owner, `X:${bobur.id}`)
    expect((await getRegistration(db, bobur.id))!.registration.status).toBe("rejected")
    expect(calls[0].params.caption).toContain("Rejected by Malika")
    expect(calls.find((c) => c.method === "sendMessage")?.params.chat_id).toBe("3")
  })

  it("tells an attendee when their payment time ran out", async () => {
    const reg = await register(db, event, "esc", people[2].id, input)
    expect(reg.status).toBe("held")
    await expireHolds(db, event.id, new Date(Date.now() + 31 * 60_000))
    expect(await notifyAttendees(ctx, event.id)).toBe(1)
    expect(calls[0].params.text).toContain("Время на оплату")
  })

  it("catches up on receipts nobody was told about", async () => {
    const again = await register(db, event, "esc", people[2].id, input)
    await attachReceipt(db, again.id, "image/jpeg", Buffer.from("late"))
    expect(await notifyPendingReceipts(ctx, new Date(Date.now() + 60_000))).toBe(1)
    expect(await notifyPendingReceipts(ctx, new Date(Date.now() + 60_000))).toBe(0)
  })

  it("answers /start in the person's language", async () => {
    await handleUpdate(ctx, { update_id: 3, message: { message_id: 1, chat: { id: 42 }, from: { id: 42, language_code: "uz" }, text: "/start" } })
    expect(calls[0].method).toBe("sendMessage")
    expect(calls[0].params.text).toContain("izipass boti")
    await handleUpdate(ctx, { update_id: 4, message: { message_id: 2, chat: { id: 1 }, from: { id: 1, language_code: "ru" }, text: "/start" } })
    expect(calls[1].params.text).toContain("This is the izipass bot")
  })

  it("keeps going when Telegram refuses a message", async () => {
    const failing: TelegramApi = async () => {
      throw new Error("Forbidden: bot was blocked by the user")
    }
    const reg = (await db.select().from(schema.registrations)).find((r) => r.userId === people[2].id)!
    await decide(db, event.id, reg.id, "confirmed", owner.id)
    expect(await notifyAttendees({ ...ctx, api: failing }, event.id)).toBe(0)
  })

  it("posts JSON, or multipart with a file, to the Bot API", async () => {
    const seen: { url: string; body: unknown }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      seen.push({ url, body: init.body })
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }))
    }) as unknown as typeof fetch
    const client = createTelegramApi("123:abc", fake)
    expect(await client("sendMessage", { chat_id: 1, text: "hi" })).toEqual({ message_id: 5 })
    await client("sendPhoto", { chat_id: 1, reply_markup: { inline_keyboard: [] } }, { field: "photo", data: Buffer.from("x"), contentType: "image/jpeg", name: "r.jpg" })
    expect(seen[0].url).toBe("https://api.telegram.org/bot123:abc/sendMessage")
    expect(seen[0].body).toBe(JSON.stringify({ chat_id: 1, text: "hi" }))
    const form = seen[1].body as FormData
    expect(form.get("reply_markup")).toBe('{"inline_keyboard":[]}')
    expect(form.get("photo")).toBeInstanceOf(Blob)
    const failing = createTelegramApi("t", (async () => new Response(JSON.stringify({ ok: false, description: "Bad Request" }), { status: 400 })) as unknown as typeof fetch)
    await expect(failing("sendMessage", {})).rejects.toThrow("Bad Request")
  })
})
