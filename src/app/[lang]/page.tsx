import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Check, CreditCard, ReceiptText, ScanLine, Send, Wallet, X } from "lucide-react"

import { HeroPasses } from "@/components/landing/hero-passes"
import { HowItWorks, type HowDemo } from "@/components/landing/how-it-works"
import { QrMark, WalletPass, type PassData, type PassTone } from "@/components/landing/wallet-pass"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AUTO_CHECK_PRICE_UZS, PLAN_LIMITS } from "@/lib/db/schema"
import { LOCALES, LOCALE_NAMES, isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { fmt } from "@/lib/i18n/format"
import { qrPath } from "@/lib/qr-path"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { formatMoney, formatWeekdayTime } from "@/lib/time"
import { cn } from "@/lib/utils"

/** Sample passes: when each sample event starts, and its color. */
const PASS_TIMES = [
  "2026-11-05T14:00:00Z",
  "2026-11-07T02:00:00Z",
  "2026-11-11T14:30:00Z",
  "2026-11-13T04:00:00Z",
  "2026-11-14T15:00:00Z",
  "2026-11-15T06:00:00Z",
]
const PASS_TONES: PassTone[] = [1, 2, 4, 3, 0, 5]

const GRADIENT_TEXT = "bg-linear-to-r from-chart-1 via-chart-5 to-chart-4 bg-clip-text text-transparent"

function IconTile({ icon: Icon }: { icon: typeof Wallet }) {
  return (
    <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-2.5" strokeWidth={3} aria-hidden />
      </span>
      {children}
    </li>
  )
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 text-center sm:mb-12">
      <span className="text-sm font-medium text-muted-foreground">{eyebrow}</span>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h2>
      {children}
    </div>
  )
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const l = dict.landing
  const uzs = dict.public.uzs
  const money = (n: number) => `${formatMoney(n, lang)} ${uzs}`
  const createHref = `/${lang}/events/new`
  const free = PLAN_LIMITS.free
  const pro = PLAN_LIMITS.pro

  const qr = qrPath(SITE_URL)
  const passes: PassData[] = l.passes.map((p, i) => ({
    ...p,
    meta: formatWeekdayTime(new Date(PASS_TIMES[i]), lang),
    tone: PASS_TONES[i],
  }))
  const demo: HowDemo = {
    event: l.demo.event,
    when: passes[0].meta,
    paid: l.demo.paid,
    price: money(50_000),
    spots: fmt(l.demo.spots, { n: 20 }),
    org: passes[0].org,
    post: l.demo.post,
    link: new URL(SITE_URL).host,
    register: l.demo.register,
    receipt: `Bobur · ${money(50_000)}`,
    autoPassed: l.demo.autoPassed,
    approve: l.demo.approve,
    reject: l.demo.reject,
    approved: l.demo.approved,
    checkedIn: fmt(l.demo.checkedIn, { name: "Bobur" }),
    reference: "ESC-4378 · 18:57",
    countBefore: fmt(l.demo.inCount, { n: 12, total: 20 }),
    countAfter: fmt(l.demo.inCount, { n: 13, total: 20 }),
  }

  return (
    <>
      <SiteHeader
        lang={lang}
        dict={dict}
        links={[
          { href: "#how", label: l.how },
          { href: "#pricing", label: l.pricing },
        ]}
      />
      <main className="flex flex-1 flex-col">
        {/* Hero: the passes float around the headline (on narrower screens, above it). */}
        <section className="relative overflow-hidden">
          <HeroPasses passes={passes} qr={qr} />
          <div className="h-62 sm:h-72 xl:hidden" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pb-16 text-center sm:gap-6 sm:pb-24 xl:min-h-205 xl:justify-center xl:pb-16">
            <Badge variant="outline" className="h-auto max-w-full bg-card px-2.5 py-1 text-xs whitespace-normal sm:text-sm">
              <Send aria-hidden />
              {l.badge}
            </Badge>
            <h1 className="text-5xl leading-[1.04] font-semibold tracking-tighter text-balance sm:text-6xl xl:text-7xl">
              {l.title}
              <br />
              <span className={GRADIENT_TEXT}>{l.titleAccent}</span>
            </h1>
            <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">{l.subtitle}</p>
            <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row sm:gap-3">
              <Button size="lg" className="h-12 w-full px-7 text-base sm:w-auto" asChild>
                <Link href={createHref}>{l.cta}</Link>
              </Button>
              <Button size="lg" variant="ghost" className="h-12 px-6 text-base" asChild>
                <a href="#how">
                  {l.seeHow}
                  <ArrowRight />
                </a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{fmt(l.note, { n: free.eventsPerMonth })}</p>
          </div>
        </section>

        <section id="how" className="scroll-mt-16 px-4 pt-4 pb-16 sm:px-8 sm:pb-24 xl:pt-0">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow={l.how} title={l.howTitle} />
            <HowItWorks steps={l.steps} demo={demo} />
          </div>
        </section>

        {/* Features */}
        <section className="px-4 pb-16 sm:px-8 sm:pb-28">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Card className="relative gap-6 overflow-hidden bg-[radial-gradient(circle_at_85%_40%,color-mix(in_oklab,var(--chart-1)_16%,transparent),transparent_55%)] p-6 sm:col-span-2 sm:grid sm:grid-cols-[1fr_15rem] sm:items-center sm:p-8 lg:col-span-4">
              <div className="flex flex-col gap-2.5">
                <IconTile icon={Wallet} />
                <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{l.ticketsTitle}</h3>
                <p className="text-muted-foreground">{l.ticketsBody}</p>
              </div>
              <div className="relative h-56">
                <WalletPass pass={{ ...passes[2], tone: 3 }} qr={qr} className="absolute top-6 left-6 -rotate-6" />
                <WalletPass pass={passes[0]} qr={qr} className="absolute top-11 left-15 rotate-4" />
              </div>
            </Card>

            <Card className="gap-3 p-6 lg:col-span-2">
              <IconTile icon={Send} />
              <h3 className="text-lg font-semibold">{l.telegramTitle}</h3>
              <p className="text-sm text-muted-foreground">{l.telegramBody}</p>
              <div className="mt-auto flex items-end gap-2.5 pt-2" aria-hidden>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground">
                  iz
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-sm border bg-background p-2.5">
                    <span className="flex h-11 w-9 shrink-0 flex-col gap-1 rounded-md bg-muted p-1.5">
                      <i className="h-0.5 rounded-full bg-border" />
                      <i className="h-0.5 w-2/3 rounded-full bg-border" />
                      <i className="mt-auto h-0.5 rounded-full bg-border" />
                    </span>
                    <div className="min-w-0 text-xs">
                      <p className="truncate text-sm font-semibold">{fmt(l.telegramReceipt, { name: "Dilnoza" })}</p>
                      <p className="truncate text-muted-foreground">
                        {passes[0].title} · {money(50_000)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" variant="secondary" tabIndex={-1} className="pointer-events-none">
                      <Check />
                      {l.demo.approve}
                    </Button>
                    <Button size="sm" variant="secondary" tabIndex={-1} className="pointer-events-none">
                      <X />
                      {l.demo.reject}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="gap-3 p-6 lg:col-span-2">
              <IconTile icon={ReceiptText} />
              <h3 className="text-lg font-semibold">{l.autoTitle}</h3>
              <p className="text-sm text-muted-foreground">{l.autoBody}</p>
              <ul className="mt-auto flex flex-col gap-1.5 pt-2">
                <CheckItem>{fmt(l.autoAmount, { amount: money(50_000) })}</CheckItem>
                <CheckItem>{fmt(l.autoDate, { time: "18:42" })}</CheckItem>
                <CheckItem>{fmt(l.autoCard, { last4: "9012" })}</CheckItem>
              </ul>
            </Card>

            <Card className="gap-3 p-6 lg:col-span-2">
              <IconTile icon={ScanLine} />
              <h3 className="text-lg font-semibold">{l.checkinTitle}</h3>
              <p className="text-sm text-muted-foreground">{l.checkinBody}</p>
              <div className="mt-auto flex flex-col gap-2 pt-2" aria-hidden>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-3/5 rounded-full bg-linear-to-r from-chart-1 via-chart-5 to-chart-4" />
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">{fmt(l.demo.inCount, { n: 12, total: 20 })}</span>
              </div>
            </Card>

            <Card className="gap-3 border-primary bg-primary p-6 text-primary-foreground sm:col-span-2 lg:col-span-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
                <CreditCard className="size-4" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold">{l.moneyTitle}</h3>
              <p className="text-sm text-primary-foreground/75">{l.moneyBody}</p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                <span className="text-7xl leading-none font-semibold tracking-tighter">0%</span>
                <div className="flex flex-col items-end gap-1.5" aria-hidden>
                  {[l.moneyCard, "Click", "Payme"].map((x) => (
                    <span key={x} className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-medium">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-16 border-y bg-card px-4 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-4xl">
            <SectionHeading eyebrow={l.pricing} title={l.pricingTitle}>
              <p className="max-w-lg text-pretty text-muted-foreground sm:text-lg">{l.pricingSubtitle}</p>
            </SectionHeading>
            <div className="grid gap-4 md:grid-cols-2 md:gap-5">
              {(
                [
                  ["free", free, l.freeUnit, l.startFree, l.freeLead, l.freeExtras],
                  ["pro", pro, l.proUnit, l.getPro, l.proLead, l.proExtras],
                ] as const
              ).map(([plan, limits, unit, cta, lead, extras]) => {
                const popular = plan === "pro"
                return (
                  <Card key={plan} className={cn("gap-5 p-7", popular && "border-primary shadow-lg")}>
                    <div className="flex items-center justify-between">
                      <span className={cn("font-semibold", popular && "text-chart-1")}>{dict.plans[plan]}</span>
                      {popular && <Badge>{l.popular}</Badge>}
                    </div>
                    <div>
                      <p className="text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl">{money(limits.priceUzs)}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{unit}</p>
                    </div>
                    <Button size="lg" variant={popular ? "default" : "outline"} className="w-full" asChild>
                      <Link href={createHref}>{cta}</Link>
                    </Button>
                    <ul className="flex flex-col gap-2.5">
                      <li className="text-sm text-muted-foreground">{lead}</li>
                      <CheckItem>{fmt(l.eventsLimit, { n: limits.eventsPerMonth })}</CheckItem>
                      <CheckItem>{fmt(l.peopleLimit, { n: limits.participantsPerEvent })}</CheckItem>
                      {extras.map((x) => (
                        <CheckItem key={x}>{x}</CheckItem>
                      ))}
                    </ul>
                  </Card>
                )
              })}
            </div>
            <Card className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-3 border-transparent bg-muted p-5 shadow-none sm:mt-5 sm:flex-nowrap sm:px-7">
              <ReceiptText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.addonTitle}</p>
                <p className="text-sm text-muted-foreground">{l.addonBody}</p>
              </div>
              <div className="flex basis-full items-baseline gap-2 sm:basis-auto sm:flex-col sm:items-end sm:gap-0">
                <span className="text-xl font-semibold whitespace-nowrap tabular-nums">{money(AUTO_CHECK_PRICE_UZS)}</span>
                <span className="text-sm text-muted-foreground">{l.addonUnit}</span>
              </div>
            </Card>
            <p className="mt-4 text-center text-sm text-muted-foreground">{l.proNote}</p>
          </div>
        </section>

        {/* The closing call to action is one big ticket with a tear-off stub. */}
        <section className="px-4 py-16 sm:px-8 sm:py-28">
          <div className="relative mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg lg:grid-cols-[1fr_17.5rem] lg:rounded-[2rem]">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(60%_80%_at_20%_0%,color-mix(in_oklab,var(--chart-1)_55%,transparent),transparent_70%),radial-gradient(50%_70%_at_75%_100%,color-mix(in_oklab,var(--chart-2)_45%,transparent),transparent_70%)]"
            />
            <div className="relative flex flex-col justify-center gap-4 p-6 sm:p-10 lg:gap-5 lg:p-16">
              <h2 className="text-4xl leading-[1.04] font-semibold tracking-tighter sm:text-5xl lg:text-6xl">
                {l.finalTitle}
                <br />
                <span className={GRADIENT_TEXT}>{l.finalAccent}</span>
              </h2>
              <p className="text-primary-foreground/75 sm:text-lg">{fmt(l.finalBody, { n: free.eventsPerMonth })}</p>
              <div>
                <Button size="lg" variant="secondary" className="h-12 w-full px-7 text-base sm:w-auto" asChild>
                  <Link href={createHref}>{l.cta}</Link>
                </Button>
              </div>
            </div>
            <div className="relative flex items-center gap-4 border-t-2 border-dashed border-primary-foreground/30 p-6 lg:flex-col lg:items-start lg:justify-between lg:border-t-0 lg:border-l-2 lg:p-8 lg:py-11">
              <span aria-hidden className="absolute -top-[23px] -left-[22px] size-11 rounded-full bg-background lg:-top-[22px] lg:-left-[23px]" />
              <span aria-hidden className="absolute -top-[23px] -right-[22px] size-11 rounded-full bg-background lg:top-auto lg:right-auto lg:-bottom-[22px] lg:-left-[23px]" />
              <p className="hidden font-mono text-xs tracking-widest uppercase opacity-70 lg:block">
                {l.admitOne}
                <br />
                {SITE_NAME} · 2026
              </p>
              <span className="shrink-0 rounded-xl bg-primary-foreground p-2.5 text-primary lg:self-center lg:rounded-2xl lg:p-3.5">
                <QrMark qr={qr} className="size-22 lg:size-32" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-mono text-[11px] tracking-widest uppercase opacity-70 lg:hidden">
                  {l.admitOne} · {SITE_NAME}
                </span>
                <span className="hidden text-sm opacity-70 lg:block">{l.guest}</span>
                <span className="font-semibold">{l.yourCommunity}</span>
                <span className="font-mono text-sm opacity-70">ESC-0001</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-mono font-medium">{SITE_NAME}</span>
          <p className="text-muted-foreground sm:max-w-md sm:text-center">{dict.footer}</p>
          <nav className="flex gap-3 text-muted-foreground" aria-label={dict.language}>
            {LOCALES.map((x) => (
              <Link key={x} href={`/${x}`} hrefLang={x} lang={x} className={cn("hover:text-foreground", x === lang && "text-foreground")}>
                {LOCALE_NAMES[x]}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  )
}
