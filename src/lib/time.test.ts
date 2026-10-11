import { describe, expect, it } from "vitest"

import { formatDateTime, fromLocalInput, startOfMonth, toLocalInput } from "@/lib/time"

describe("Tashkent time helpers", () => {
  it("round-trips datetime-local values", () => {
    const date = fromLocalInput("2026-10-20T19:30")
    expect(date?.toISOString()).toBe("2026-10-20T14:30:00.000Z")
    expect(toLocalInput(date!)).toBe("2026-10-20T19:30")
    expect(fromLocalInput("nope")).toBeNull()
  })

  it("formats in the locale", () => {
    const date = new Date("2026-10-20T14:30:00Z")
    expect(formatDateTime(date, "en")).toContain("19:30")
    expect(formatDateTime(date, "ru")).toContain("октября")
  })

  it("finds the start of the month in Tashkent", () => {
    // 2026-10-31 22:00 UTC is already 1 Nov in Tashkent
    expect(startOfMonth(new Date("2026-10-31T22:00:00Z")).toISOString()).toBe("2026-10-31T19:00:00.000Z")
  })
})
