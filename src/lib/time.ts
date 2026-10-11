import type { Locale } from "@/lib/i18n/config"

/** All event times are entered and shown in Tashkent time (UTC+5, no DST). */
export const TIME_ZONE = "Asia/Tashkent"
const OFFSET = "+05:00"

/** `datetime-local` value (e.g. "2026-10-20T19:00") → UTC instant. */
export function fromLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value}:00${OFFSET}`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** UTC instant → `datetime-local` value in Tashkent time. */
export function toLocalInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

const INTL_LOCALE: Record<Locale, string> = { uz: "uz-Latn-UZ", ru: "ru-RU", kk: "kk-KZ", en: "en-GB" }

export function formatDateTime(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

export function formatDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(date)
}

export function formatMoney(uzs: number, locale: Locale) {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(uzs)
}

/** First instant of the current calendar month in Tashkent, for monthly plan limits. */
export function startOfMonth(now = new Date()) {
  const ym = toLocalInput(now).slice(0, 7)
  return new Date(`${ym}-01T00:00:00${OFFSET}`)
}

/** "Thu 5 November at 19:00 – 21:00" on one day; two full dates otherwise. */
export function formatDateRange(start: Date, end: Date | null, locale: Locale) {
  if (!end) return formatDateTime(start, locale)
  if (toLocalInput(start).slice(0, 10) === toLocalInput(end).slice(0, 10)) {
    const time = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    return `${formatDateTime(start, locale)} – ${time.format(end)}`
  }
  return `${formatDateTime(start, locale)} – ${formatDateTime(end, locale)}`
}
