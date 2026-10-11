const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  // Uzbek and Kazakh letters
  ў: "o", қ: "q", ғ: "g", ҳ: "h", ә: "a", ө: "o", ү: "u", ұ: "u", ң: "n", һ: "h", і: "i",
}

/** URL slug from a title in Latin, Uzbek or Kazakh/Russian Cyrillic. */
export function slugify(input: string, maxLength = 48) {
  const latin = input
    .toLowerCase()
    .replace(/[ʼʻ’‘'`]/g, "")
    .replace(/[а-яёўқғҳәөүұңһі]/g, (ch) => CYRILLIC[ch] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "")
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/

/** Paths under /[lang]/ that an organizer slug must not shadow. */
export const RESERVED_SLUGS = new Set(["login", "dashboard", "events", "organizations", "settings", "o", "e", "t", "r", "api", "admin", "stats", "izipass"])
