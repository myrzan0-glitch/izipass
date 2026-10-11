import { describe, expect, it } from "vitest"

import { toCsv } from "./csv"

describe("toCsv", () => {
  it("quotes, keeps Cyrillic, and defuses spreadsheet formulas", () => {
    const csv = toCsv([
      ["Имя", "Note"],
      ["Азиза", 'Says "hi", twice'],
      ["=HYPERLINK(\"x\")", "+998901234567"],
      [null, 5],
    ])
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv).toBe('﻿Имя,Note\r\nАзиза,"Says ""hi"", twice"\r\n"\'=HYPERLINK(""x"")",+998901234567\r\n,5\r\n')
  })
})
