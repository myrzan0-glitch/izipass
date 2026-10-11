import { describe, expect, it } from "vitest"

import { SLUG_PATTERN, slugify } from "@/lib/slug"

describe("slugify", () => {
  it("handles Latin, Uzbek and Cyrillic titles", () => {
    expect(slugify("English Speaking Club #12")).toBe("english-speaking-club-12")
    expect(slugify("O‘zbek tili klubi")).toBe("ozbek-tili-klubi")
    expect(slugify("Разговорный клуб: четверг")).toBe("razgovorniy-klub-chetverg")
    expect(slugify("Қазақ тілі үйірмесі")).toBe("qazaq-tili-uyirmesi")
  })

  it("produces valid slugs", () => {
    for (const s of ["  --Hello--  ", "a".repeat(100), "Ёлка & Co."]) expect(slugify(s)).toMatch(SLUG_PATTERN)
  })
})
