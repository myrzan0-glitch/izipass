import en from "./dictionaries/en"
import kk from "./dictionaries/kk"
import ru from "./dictionaries/ru"
import uz from "./dictionaries/uz"
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config"

/**
 * All dictionaries, loaded eagerly. For server code that writes to many
 * people in their own language (bot messages); pages use getDictionary.
 */
export const DICTIONARIES = { uz, ru, kk, en } as const

export function dictionaryFor(locale: string | null | undefined) {
  return DICTIONARIES[locale && isLocale(locale) ? locale : DEFAULT_LOCALE]
}

/** Telegram's `language_code` (e.g. "ru", "uz", "en-US") → our locale. */
export function localeFromTelegram(code: string | undefined): Locale {
  const base = (code ?? "").slice(0, 2).toLowerCase()
  return isLocale(base) ? base : DEFAULT_LOCALE
}
