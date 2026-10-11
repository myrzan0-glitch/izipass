/** CSV that Excel opens correctly with Cyrillic and Uzbek text (UTF-8 BOM, CRLF). */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v)
    // Quote when needed; a leading = + - @ would run as a formula in spreadsheets.
    const safe = /^[=+\-@]/.test(s) && !/^[+-]?\d/.test(s) ? `'${s}` : s
    return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
}
