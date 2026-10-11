/**
 * Receipt auto-check without any paid service: the attendee's browser runs
 * OCR (tesseract.js) on the screenshot, this module turns the text into
 * fields and compares them with what the organizer expects. Everything here
 * is pure and runs on the server; the OCR text is attacker-controlled, so the
 * organizer always keeps the screenshot and the last word.
 */

export type Provider = "click" | "payme" | "uzum" | "paynet" | "bank" | "unknown"
export type ReceiptStatus = "success" | "failed"

export type ParsedReceipt = {
  provider: Provider
  /** Money-looking numbers in so'm, in order of appearance. */
  amounts: number[]
  /** Payment time (Tashkent), or null when no date was recognized. */
  paidAt: Date | null
  /** Whether a clock time was read next to the date; without it only the day is known. */
  hasTime: boolean
  /** Last four digits of masked card numbers. */
  cardLast4: string[]
  receiptNo: string | null
  status: ReceiptStatus | null
}

export type CheckName = "amount" | "time" | "recipient" | "status" | "reference" | "duplicate"
export type CheckResult = "ok" | "mismatch" | "missing" | "failed" | "duplicate" | "skipped"
export type Checks = Record<CheckName, CheckResult>
export type Verdict = "pass" | "review" | "fail"

export type CheckContext = {
  priceUzs: number
  /** When the attendee registered (payments before that are suspicious). */
  registeredAt: Date
  /** When the receipt was uploaded (payments after that are impossible). */
  uploadedAt: Date
  referenceCode: string
  payoutCardLast4: string | null
  payoutName: string | null
  /** The same receipt (image hash or receipt number) was already used elsewhere. */
  duplicate: boolean
}

const CURRENCY = /(?:сум|сўм|сом|so'?m|so‘m|so’m|uzs)/i
const AMOUNT_LABEL = /(?:сумма|summa|amount|итого|jami|total|к оплате|to'?lov|оплата|перевод|o'?tkazma)/i
const SUCCESS = /(?:успешн|выполнен|оплачен|проведен|завершен|muvaffaqiyatli|bajarildi|to'?landi|amalga oshirildi|success|completed|approved|paid)/i
const FAILED = /(?:отменен|отклонен|ошибк|не выполнен|неуспешн|bekor|rad etildi|xatolik|muvaffaqiyatsiz|failed|declined|cancel+ed|error)/i

const MONTH_STEMS: [RegExp, number][] = [
  [/^(янв|yanv|jan)/, 1], [/^(фев|fev|feb)/, 2], [/^(мар|mar)/, 3], [/^(апр|apr)/, 4], [/^(ма[яй]|may)$/, 5],
  [/^(июн|iyun|jun)/, 6], [/^(июл|iyul|jul)/, 7], [/^(авг|avg|aug)/, 8], [/^(сен|sen|sep)/, 9], [/^(окт|okt|oct)/, 10],
  [/^(ноя|noy|nov)/, 11], [/^(дек|dek|dec)/, 12],
]

/** "октября", "oktabr", "Oct" → 10; any other word → null. */
function monthFromWord(word: string) {
  const w = word.toLowerCase()
  for (const [re, n] of MONTH_STEMS) if (re.test(w)) return n
  return null
}

const TIME = /(\d{1,2})[:.](\d{2})(?::\d{2})?/

/** Spaces OCR tends to produce; digits mistaken for letters inside numbers. */
export function normalizeText(text: string) {
  return text
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/\b(?=[\dOo]*\d)[\dOo]+\b/g, (token) => token.replace(/[Oo]/g, "0"))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim()
}

function parseAmount(raw: string): number | null {
  const s = raw.replace(/[ '’]/g, "")
  let int: string
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(s)) int = s.replace(/,/g, "").replace(/\.\d{2}$/, "")
  else if (/^\d+[.,]\d{2}$/.test(s)) int = s.slice(0, -3)
  else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) int = s.replace(/[.,]/g, "")
  else if (/^\d+$/.test(s)) int = s
  else return null
  const n = Number(int)
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : null
}

function parseAmounts(text: string) {
  const out: number[] = []
  // "50 000", "50 000.00", "50,000.00", "50000"
  const re = /(?<![\d:.,/-])(\d{1,3}(?:[ '’]\d{3})+(?:[.,]\d{2})?|\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{4,9}(?:[.,]\d{2})?)(?![\d:/-])/g
  for (const m of text.matchAll(re)) {
    const raw = m[1]
    const start = m.index ?? 0
    const before = text.slice(Math.max(0, start - 24), start)
    const after = text.slice(start + raw.length, start + raw.length + 12)
    const grouped = /[ '’,]/.test(raw)
    const near = CURRENCY.test(after) || AMOUNT_LABEL.test(before)
    // Years and card fragments are 4-digit groups too; a plain number needs context.
    if (!grouped && !near) continue
    if (!grouped && /^(19|20)\d{2}$/.test(raw) && !CURRENCY.test(after)) continue
    const n = parseAmount(raw)
    if (n !== null && !out.includes(n)) out.push(n)
  }
  return out
}

function tashkent(y: number, mo: number, d: number, h = 0, mi = 0) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  const date = new Date(`${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+05:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function year(raw: string | undefined, now: Date) {
  if (!raw) return now.getFullYear()
  const n = Number(raw)
  return raw.length === 2 ? 2000 + n : n
}

function parseDate(text: string, now: Date): { paidAt: Date | null; hasTime: boolean } {
  const candidates: { date: Date; hasTime: boolean; index: number }[] = []
  const push = (date: Date | null, hasTime: boolean, index: number) => {
    if (!date) return
    const y = date.getFullYear()
    if (y >= 2020 && y <= now.getFullYear() + 1) candidates.push({ date, hasTime, index })
  }
  const timeNear = (from: number) => {
    const m = TIME.exec(text.slice(from, from + 24))
    return m ? { h: Number(m[1]), mi: Number(m[2]) } : null
  }
  const timeBefore = (to: number) => {
    const m = TIME.exec(text.slice(Math.max(0, to - 12), to))
    return m ? { h: Number(m[1]), mi: Number(m[2]) } : null
  }

  // 11.10.2026 14:32 · 11/10/26, 14:32 · 14:32 11.10.2026
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/g)) {
    const i = m.index ?? 0
    const t = timeNear(i + m[0].length) ?? timeBefore(i)
    push(tashkent(year(m[3], now), Number(m[2]), Number(m[1]), t?.h, t?.mi), !!t, i)
  }
  // 2026-10-11 14:32:05 (ISO-ish)
  for (const m of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const i = m.index ?? 0
    const t = timeNear(i + m[0].length)
    push(tashkent(Number(m[1]), Number(m[2]), Number(m[3]), t?.h, t?.mi), !!t, i)
  }
  // 11 октября 2026, 14:32 · 11-oktabr 2026 · 11 Oct 2026
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[ -]?([а-яё]{3,8}|[a-z]{3,9})\.?,?(?:[ ,]+(\d{4}))?/gi)) {
    const mo = monthFromWord(m[2])
    if (!mo) continue
    const i = m.index ?? 0
    const t = timeNear(i + m[0].length) ?? timeBefore(i)
    push(tashkent(year(m[3], now), mo, Number(m[1]), t?.h, t?.mi), !!t, i)
  }

  if (candidates.length === 0) return { paidAt: null, hasTime: false }
  // Prefer a date that has a time next to it, then the first one on the receipt.
  candidates.sort((a, b) => Number(b.hasTime) - Number(a.hasTime) || a.index - b.index)
  return { paidAt: candidates[0].date, hasTime: candidates[0].hasTime }
}

function parseCards(text: string) {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:\d{4}\s?)?[*•·xX●]{2,}\s?(?:[*•·xX●]{2,}\s?)*(\d{4})(?!\d)/g)) out.add(m[1])
  for (const m of text.matchAll(/(?<!\d)(?:\d{4}[ -]){3}(\d{4})(?!\d)/g)) out.add(m[1])
  return [...out]
}

function parseReceiptNo(text: string) {
  const re = /(?:№|#|\bno\.?|\bid\b|чек|chek|raqam\w*|транзакци\w*|операци\w*|tranzaksiya\w*|transaction|операция|квитанци\w*|kvitansiya|receipt)\D{0,25}?(?<![+\d])(\d{6,20})(?!\d)/gi
  for (const m of text.matchAll(re)) {
    const n = m[1]
    if (/^998\d{9}$/.test(n)) continue // a phone number
    return n
  }
  return null
}

function parseProvider(text: string): Provider {
  if (/\bclick\b/i.test(text)) return "click"
  if (/payme|пайми|пэйми/i.test(text)) return "payme"
  if (/\buzum\b/i.test(text)) return "uzum"
  if (/paynet/i.test(text)) return "paynet"
  if (/bank|банк|kapital|tbc|anor|ipoteka|hamkor|asaka|xalq|davr|trast|uzcard|humo/i.test(text)) return "bank"
  return "unknown"
}

function parseStatus(rawText: string): ReceiptStatus | null {
  const text = rawText.replace(/ё/g, "е").replace(/Ё/g, "Е")
  const ok = SUCCESS.test(text)
  const bad = FAILED.test(text)
  if (ok && !bad) return "success"
  if (bad && !ok) return "failed"
  return null
}

export function parseReceipt(rawText: string, now = new Date()): ParsedReceipt {
  const text = normalizeText(rawText)
  const { paidAt, hasTime } = parseDate(text, now)
  return {
    provider: parseProvider(text),
    amounts: parseAmounts(text),
    paidAt,
    hasTime,
    cardLast4: parseCards(text),
    receiptNo: parseReceiptNo(text),
    status: parseStatus(text),
  }
}

const CYRILLIC_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
}

/** Lowercase Latin letters only, so "Азиза" and "AZIZA" compare equal. */
function latinize(s: string) {
  return s
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC_LATIN[ch] ?? "")
    .replace(/[ʼʻ’‘'`]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, " ")
}

export function nameMatches(text: string, payoutName: string) {
  const hay = ` ${latinize(text)} `
  const tokens = latinize(payoutName).split(" ").filter((t) => t.length >= 3)
  return tokens.length > 0 && tokens.some((t) => hay.includes(` ${t} `))
}

export function referenceMatches(text: string, referenceCode: string) {
  const [letters, digits] = referenceCode.split("-")
  if (!letters || !digits) return false
  return new RegExp(`${letters}\\s*[-–—]?\\s*${digits}(?!\\d)`, "i").test(text)
}

export function checkReceipt(parsed: ParsedReceipt, rawText: string, ctx: CheckContext): { verdict: Verdict; checks: Checks } {
  const text = normalizeText(rawText)
  const checks: Checks = {
    amount: parsed.amounts.length === 0 ? "missing" : parsed.amounts.includes(ctx.priceUzs) ? "ok" : "mismatch",
    time: "missing",
    recipient: "skipped",
    status: parsed.status === null ? "missing" : parsed.status === "success" ? "ok" : "failed",
    reference: referenceMatches(text, ctx.referenceCode) ? "ok" : "missing",
    duplicate: ctx.duplicate ? "duplicate" : "ok",
  }

  if (parsed.paidAt) {
    // Paid up to 2 days before registering (some pay first) and not after the upload.
    const earliest = ctx.registeredAt.getTime() - 2 * 86_400_000
    const latest = ctx.uploadedAt.getTime() + 60 * 60_000
    const paid = parsed.paidAt.getTime()
    // Without a clock time the whole day counts.
    const dayEnd = parsed.hasTime ? paid : paid + 86_400_000 - 60_000
    checks.time = dayEnd >= earliest && paid <= latest ? "ok" : "mismatch"
  }

  const last4 = ctx.payoutCardLast4?.trim() || null
  const name = ctx.payoutName?.trim() || null
  if (last4 || name) {
    const cardOk = !!last4 && parsed.cardLast4.includes(last4)
    const nameOk = !!name && nameMatches(text, name)
    if (cardOk || nameOk) checks.recipient = "ok"
    else if (last4 && parsed.cardLast4.length > 0) checks.recipient = "mismatch"
    else checks.recipient = "missing"
  }

  const fail =
    checks.duplicate === "duplicate" ||
    checks.status === "failed" ||
    checks.amount === "mismatch" ||
    checks.time === "mismatch" ||
    checks.recipient === "mismatch"
  const pass =
    !fail &&
    checks.amount === "ok" &&
    checks.time === "ok" &&
    (checks.recipient === "ok" || checks.recipient === "skipped") &&
    checks.status !== "failed"
  return { verdict: fail ? "fail" : pass ? "pass" : "review", checks }
}
