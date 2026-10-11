import { describe, expect, it } from "vitest"

import { googleCalendarUrl, icsFile } from "@/lib/calendar"
import { paymentDetails } from "@/lib/payment-text"
import { formatDateRange } from "@/lib/time"

const start = new Date("2026-11-05T14:00:00Z") // 19:00 Tashkent

describe("formatDateRange", () => {
  it("shows only the end time on the same day", () => {
    expect(formatDateRange(start, new Date("2026-11-05T16:00:00Z"), "en")).toBe("Thu 5 November at 19:00 – 21:00")
    expect(formatDateRange(start, null, "en")).toBe("Thu 5 November at 19:00")
    expect(formatDateRange(start, new Date("2026-11-06T16:00:00Z"), "en")).toBe("Thu 5 November at 19:00 – Fri 6 November at 21:00")
  })
})

describe("calendar", () => {
  const event = { id: "e1", title: "Club; travel, stories", startsAt: start, endsAt: null, venue: "Bon! cafe, Amir Temur 15", url: "https://izipass.test/en/o/esc/thu", description: "Bring a photo.\nAll levels." }

  it("builds an .ics file with escaped text and a two-hour default", () => {
    const ics = icsFile(event, new Date("2026-10-11T00:00:00Z"))
    expect(ics).toContain("DTSTART:20261105T140000Z\r\nDTEND:20261105T160000Z")
    expect(ics).toContain("SUMMARY:Club\\; travel\\, stories")
    expect(ics).toContain("LOCATION:Bon! cafe\\, Amir Temur 15")
    expect(ics).toContain("UID:e1@izipass")
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    const long = icsFile({ ...event, description: "Разговорный клуб ".repeat(20) })
    expect(long).toContain("\r\n ")
  })

  it("links to Google Calendar", () => {
    const url = new URL(googleCalendarUrl(event))
    expect(url.searchParams.get("dates")).toBe("20261105T140000Z/20261105T160000Z")
    expect(url.searchParams.get("text")).toBe(event.title)
  })
})

describe("paymentDetails", () => {
  it("finds card numbers and payment links", () => {
    const text = "Click: https://my.click.uz/services/pay?x=1.\nCard 8600 1234 5678 9012, AZIZA K.\nor 9860-0000-1111-2222\nPhone +998901234567"
    expect(paymentDetails(text)).toEqual({
      cards: ["8600 1234 5678 9012", "9860 0000 1111 2222"],
      links: ["https://my.click.uz/services/pay?x=1"],
    })
    expect(paymentDetails("Pay in cash at the door")).toEqual({ cards: [], links: [] })
  })
})

describe("where to pay", () => {
  it("recognizes a card, a link and anything else", async () => {
    const { describePaymentTo, cardLast4 } = await import("@/lib/payment-text")
    expect(describePaymentTo("8600 1234-5678 9012")).toEqual({ kind: "card", display: "8600 1234 5678 9012", copy: "8600123456789012" })
    expect(describePaymentTo("https://payme.uz/abc")).toMatchObject({ kind: "link", copy: "https://payme.uz/abc" })
    expect(describePaymentTo("payme.uz/abc")).toMatchObject({ kind: "link", copy: "https://payme.uz/abc" })
    expect(describePaymentTo("+998 90 123 45 67")).toMatchObject({ kind: "text" })
    expect(describePaymentTo("  ")).toBeNull()
    expect(cardLast4("8600 1234 5678 9012")).toBe("9012")
    expect(cardLast4("payme.uz/abc")).toBeNull()
  })
})
