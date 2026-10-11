import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarCheck, Check, ScanLine, Ticket, Users } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AUTO_CHECK_PRICE_UZS, PLAN_LIMITS } from "@/lib/db/schema"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { formatMoney } from "@/lib/time"

const FEATURE_ICONS = { register: Users, confirm: CalendarCheck, ticket: Ticket, checkin: ScanLine } as const

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const l = dict.landing

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:gap-14 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />

      <section className="flex max-w-2xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{dict.hero.title}</h1>
        <p className="text-base text-muted-foreground sm:text-lg">{dict.hero.subtitle}</p>
        <div>
          <Button size="lg" asChild>
            <Link href={`/${lang}/dashboard/organizer/new`}>{dict.hero.cta}</Link>
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

      <section id="how" className="flex scroll-mt-6 flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">{l.howTitle}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {([
            [l.how1Title, l.how1Body],
            [l.how2Title, l.how2Body],
            [l.how3Title, l.how3Body],
          ] as const).map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="flex scroll-mt-6 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{l.pricingTitle}</h2>
          <p className="text-muted-foreground">{l.pricingSubtitle}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(["free", "pro"] as const).map((plan) => (
            <Card key={plan}>
              <CardHeader>
                <CardTitle>{dict.plans[plan]}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-semibold text-foreground tabular-nums">{formatMoney(PLAN_LIMITS[plan].priceUzs, lang)}</span>{" "}
                  {dict.public.uzs} {PLAN_LIMITS[plan].priceUzs > 0 && l.perMonth}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {[fmt(l.eventsLimit, { n: PLAN_LIMITS[plan].eventsPerMonth }), fmt(l.peopleLimit, { n: PLAN_LIMITS[plan].participantsPerEvent }), l.included].map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </CardContent>
              {plan === "pro" && (
                <CardFooter>
                  <p className="text-xs text-muted-foreground">{l.proNote}</p>
                </CardFooter>
              )}
            </Card>
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {l.addonName}
                <Badge variant="secondary">+</Badge>
              </CardTitle>
              <CardDescription>
                <span className="text-3xl font-semibold text-foreground tabular-nums">{formatMoney(AUTO_CHECK_PRICE_UZS, lang)}</span> {dict.public.uzs}{" "}
                {l.perParticipant}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{l.addonBody}</p>
            </CardContent>
          </Card>
        </div>
        <div>
          <Button size="lg" asChild>
            <Link href={`/${lang}/dashboard/organizer/new`}>{l.startFree}</Link>
          </Button>
        </div>
      </section>

      <footer className="max-w-2xl pb-4 text-xs text-muted-foreground">
        <p>{dict.footer}</p>
      </footer>
    </main>
  )
}
