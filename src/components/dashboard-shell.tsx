import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  lang: Locale
  dict: Dictionary
  title: string
  description?: string
  back?: { href: string; label: string }
  actions?: React.ReactNode
  children: React.ReactNode
}

/** Page frame for the signed-in area: header, title row, content. */
export function DashboardShell({ lang, dict, title, description, back, actions, children }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <div className="flex flex-col gap-4">
        {back && (
          <Button variant="ghost" size="sm" className="w-fit px-0 has-[>svg]:px-0" asChild>
            <Link href={back.href}>
              <ChevronLeft />
              {back.label}
            </Link>
          </Button>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
      {children}
    </main>
  )
}
