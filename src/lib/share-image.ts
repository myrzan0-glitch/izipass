import type { Locale } from "@/lib/i18n/config"

/** The share image for link previews (see /api/og/[lang]); pages without their own picture use it. */
export function shareImage(lang: Locale, alt: string) {
  return { url: `/api/og/${lang}`, width: 1200, height: 630, alt }
}
