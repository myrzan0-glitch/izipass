import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { AppHeader, type AppSection } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { cn } from "@/lib/utils"

type Props = {
  lang: Locale
  dict: Dictionary
  /** Which top-bar section this page belongs to. */
  active?: AppSection
  title?: string
  description?: React.ReactNode
  back?: { href: string; label: string }
  actions?: React.ReactNode
  /** Content width: narrow forms, the default, or wide tables. */
  width?: "narrow" | "default" | "wide"
  children: React.ReactNode
}

const WIDTH = { narrow: "max-w-2xl", default: "max-w-3xl", wide: "max-w-5xl" }

/** Page frame for the signed-in area: top bar, title row, content. */
export function DashboardShell({ lang, dict, active = null, title, description, back, actions, width = "default", children }: Props) {
  return (
    <>
      <AppHeader lang={lang} dict={dict} active={active} />
      <main className={cn("mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-10", WIDTH[width])}>
        {(title || back) && (
          <div className="flex flex-col gap-3">
            {back && (
              <Button variant="link" size="sm" className="h-auto w-fit px-0 text-muted-foreground has-[>svg]:px-0" asChild>
                <Link href={back.href}>
                  <ChevronLeft />
                  {back.label}
                </Link>
              </Button>
            )}
            {title && (
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                  {description && <p className="text-sm text-muted-foreground">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              </div>
            )}
          </div>
        )}
        {children}
      </main>
    </>
  )
}
