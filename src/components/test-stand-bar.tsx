import { FlaskConical } from "lucide-react"

import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

/** A strip on top of every page of the test stand, so nobody mistakes it for the real site. */
export async function TestStandBar({ lang }: { lang: Locale }) {
  const dict = await getDictionary(lang)
  return (
    <div className="flex items-center justify-center gap-2 bg-chart-4 px-4 py-1.5 text-center text-xs font-medium text-foreground dark:text-background">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      {dict.testStand.banner}
    </div>
  )
}
