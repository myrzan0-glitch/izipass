import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarCheck, ScanLine, Ticket, Users } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

const FEATURE_ICONS = { register: Users, confirm: CalendarCheck, ticket: Ticket, checkin: ScanLine } as const

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:gap-14 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />

      <section className="flex max-w-2xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{dict.hero.title}</h1>
        <p className="text-base text-muted-foreground sm:text-lg">{dict.hero.subtitle}</p>
        <div>
          <Button size="lg" asChild>
            <Link href={`/${lang}/login`}>{dict.hero.cta}</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(FEATURE_ICONS) as (keyof typeof FEATURE_ICONS)[]).map((key) => {
          const Icon = FEATURE_ICONS[key]
          return (
            <Card key={key}>
              <CardHeader>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <CardTitle>{dict.features[key].title}</CardTitle>
                <CardDescription>{dict.features[key].body}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </section>

      <footer className="max-w-2xl pb-4 text-xs text-muted-foreground">
        <p>{dict.footer}</p>
      </footer>
    </main>
  )
}
