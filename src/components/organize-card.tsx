import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

/** For people who don't organize anything yet: what it takes, and the first step. */
export function OrganizeCard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.app
  const steps = [
    [t.step1Title, t.step1Body],
    [t.step2Title, t.step2Body],
    [t.step3Title, t.step3Body],
  ]
  return (
    <Card>
      <CardContent className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">{t.organizeTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.organizeBody}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link href={`/${lang}/events/new`}>{t.createEvent}</Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link href={`/${lang}#how`}>{t.howItWorks}</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t.organizeNote}</p>
        </div>
        <ol className="flex flex-col gap-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
