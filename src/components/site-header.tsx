import { AppHeader } from "@/components/app-header"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

/** The top bar of public pages: the same bar as the app, without the organizer's sections. */
export function SiteHeader({
  lang,
  dict,
  links,
}: {
  lang: Locale
  dict: Dictionary
  links?: { href: string; label: string }[]
}) {
  return <AppHeader lang={lang} dict={dict} active={null} variant="public" sections={links} />
}
