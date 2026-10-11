import { describe, expect, it } from "vitest"

import { checkReceipt, nameMatches, parseReceipt, referenceMatches, type CheckContext } from "./receipt-check"

const NOW = new Date("2026-10-11T10:00:00Z") // 15:00 Tashkent

const CLICK_RU = `CLICK
Платёж успешно выполнен
Сумма: 50 000.00 сум
Комиссия: 0.00 сум
Получатель: AZIZA K.
Карта: 8600 **** **** 1234
Дата: 11.10.2026 14:32:05
Номер транзакции: 2345678901
Комментарий: ESC-4821`

const PAYME_UZ = `Payme
Muvaffaqiyatli
50 000 so'm
Karta: 8600 ** ** 1234
Qabul qiluvchi: AZIZA KARIMOVA
11-oktabr 2026, 14:32
Chek raqami: 987654321012`

const BANK_EN = `Transfer completed
Amount 50,000.00 UZS
To card •••• 1234
2026-10-11 14:32:11
Transaction ID 55443322`

const ctx: CheckContext = {
  priceUzs: 50_000,
  registeredAt: new Date("2026-10-11T08:00:00Z"),
  uploadedAt: NOW,
  referenceCode: "ESC-4821",
  payoutCardLast4: "1234",
  payoutName: "Aziza K.",
  duplicate: false,
}

describe("parseReceipt", () => {
  it("reads a Click receipt in Russian", () => {
    const r = parseReceipt(CLICK_RU, NOW)
    expect(r.provider).toBe("click")
    expect(r.amounts).toEqual([50_000])
    expect(r.paidAt?.toISOString()).toBe("2026-10-11T09:32:00.000Z")
    expect(r.hasTime).toBe(true)
    expect(r.cardLast4).toEqual(["1234"])
    expect(r.receiptNo).toBe("2345678901")
    expect(r.status).toBe("success")
  })

  it("reads a Payme receipt in Uzbek with a month name", () => {
    const r = parseReceipt(PAYME_UZ, NOW)
    expect(r.provider).toBe("payme")
    expect(r.amounts).toEqual([50_000])
    expect(r.paidAt?.toISOString()).toBe("2026-10-11T09:32:00.000Z")
    expect(r.cardLast4).toEqual(["1234"])
    expect(r.receiptNo).toBe("987654321012")
    expect(r.status).toBe("success")
  })

  it("reads a bank app receipt in English", () => {
    const r = parseReceipt(BANK_EN, NOW)
    expect(r.amounts).toEqual([50_000])
    expect(r.paidAt?.toISOString()).toBe("2026-10-11T09:32:00.000Z")
    expect(r.cardLast4).toEqual(["1234"])
    expect(r.receiptNo).toBe("55443322")
    expect(r.status).toBe("success")
  })

  it("ignores years, phone numbers and plain numbers without context", () => {
    const r = parseReceipt("Телефон +998901234567\nГод 2026\nЧек № 123456\n12345 без контекста\nСумма 75 000 сум", NOW)
    expect(r.amounts).toEqual([75_000])
    expect(r.receiptNo).toBe("123456")
  })

  it("fixes OCR letter-O zeros inside numbers and reads a date without time", () => {
    const r = parseReceipt("Summa: 5O 0OO so'm\nSana: 10.10.2026", NOW)
    expect(r.amounts).toEqual([50_000])
    expect(r.hasTime).toBe(false)
    expect(r.paidAt?.toISOString()).toBe("2026-10-09T19:00:00.000Z")
  })

  it("recognizes a failed payment", () => {
    expect(parseReceipt("Платёж отклонён\nСумма 50 000 сум", NOW).status).toBe("failed")
    expect(parseReceipt("Сумма 50 000 сум", NOW).status).toBeNull()
  })
})

describe("checkReceipt", () => {
  it("passes a matching receipt", () => {
    const { verdict, checks } = checkReceipt(parseReceipt(CLICK_RU, NOW), CLICK_RU, ctx)
    expect(verdict).toBe("pass")
    expect(checks).toEqual({ amount: "ok", time: "ok", recipient: "ok", status: "ok", reference: "ok", duplicate: "ok" })
  })

  it("passes when the name matches instead of the card", () => {
    const text = PAYME_UZ.replace("1234", "9999")
    const { verdict, checks } = checkReceipt(parseReceipt(text, NOW), text, ctx)
    expect(checks.recipient).toBe("ok")
    expect(verdict).toBe("pass")
  })

  it("fails on a wrong amount", () => {
    const text = CLICK_RU.replace("50 000.00", "45 000.00")
    const { verdict, checks } = checkReceipt(parseReceipt(text, NOW), text, ctx)
    expect(checks.amount).toBe("mismatch")
    expect(verdict).toBe("fail")
  })

  it("fails on an old receipt (paid a week before registering)", () => {
    const text = CLICK_RU.replace("11.10.2026", "03.10.2026")
    const { verdict, checks } = checkReceipt(parseReceipt(text, NOW), text, ctx)
    expect(checks.time).toBe("mismatch")
    expect(verdict).toBe("fail")
  })

  it("fails on a receipt to another card, and on a duplicate", () => {
    const text = CLICK_RU.replace("1234", "5678").replace("AZIZA K.", "BOBUR T.")
    expect(checkReceipt(parseReceipt(text, NOW), text, ctx).checks.recipient).toBe("mismatch")
    expect(checkReceipt(parseReceipt(CLICK_RU, NOW), CLICK_RU, { ...ctx, duplicate: true }).verdict).toBe("fail")
  })

  it("asks for review when the date is missing or the payout is not configured and the card is unknown", () => {
    const noDate = "CLICK\nУспешно\nСумма 50 000 сум\nКарта **** 1234"
    expect(checkReceipt(parseReceipt(noDate, NOW), noDate, ctx).verdict).toBe("review")
    const noCard = CLICK_RU.replace("8600 **** **** 1234", "").replace("AZIZA K.", "")
    expect(checkReceipt(parseReceipt(noCard, NOW), noCard, ctx).checks.recipient).toBe("missing")
    expect(checkReceipt(parseReceipt(noCard, NOW), noCard, ctx).verdict).toBe("review")
    // Nothing configured: recipient is skipped and the rest decides.
    expect(checkReceipt(parseReceipt(noCard, NOW), noCard, { ...ctx, payoutCardLast4: null, payoutName: null }).verdict).toBe("pass")
  })

  it("accepts a whole day when the receipt has no clock time", () => {
    const text = "Payme\nMuvaffaqiyatli\n50 000 so'm\nKarta **** 1234\n11.10.2026"
    expect(checkReceipt(parseReceipt(text, NOW), text, ctx).checks.time).toBe("ok")
  })
})

describe("matchers", () => {
  it("matches names across scripts and references with loose punctuation", () => {
    expect(nameMatches("Получатель: АЗИЗА КАРИМОВА", "Aziza K.")).toBe(true)
    expect(nameMatches("Получатель: БОБУР", "Aziza Karimova")).toBe(false)
    expect(referenceMatches("Комментарий: esc 4821", "ESC-4821")).toBe(true)
    expect(referenceMatches("Комментарий: ESC-48210", "ESC-4821")).toBe(false)
  })
})
