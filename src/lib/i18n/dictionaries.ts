import "server-only"

import type { Locale } from "./config"

const dictionaries = {
  uz: () => import("./dictionaries/uz").then((m) => m.default),
  ru: () => import("./dictionaries/ru").then((m) => m.default),
  kk: () => import("./dictionaries/kk").then((m) => m.default),
  en: () => import("./dictionaries/en").then((m) => m.default),
}

export const getDictionary = (locale: Locale) => dictionaries[locale]()
export type { Dictionary } from "./dictionaries/en"
