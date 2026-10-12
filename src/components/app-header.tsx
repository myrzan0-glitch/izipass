import { Suspense } from "react"
import Link from "next/link"
import { Plus, Ticket, Users } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/auth/session"
import { getUser } from "@/lib/auth/users"
import { db } from "@/lib/db"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { SITE_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

export type AppSection = "events" | "organizations" | null

async function Account({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const session = await getSession()
  const user = session ? await getUser(db(), session.userId) : null
  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/${lang}/login`}>{dict.nav.signIn}</Link>
      </Button>
    )
  }
  const detail = user.telegramUsername ? `@${user.telegramUsername}` : user.email
  return <AccountMenu lang={lang} name={user.name || user.email || "—"} detail={detail} dict={dict} />
}

function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="mr-auto font-mono text-sm font-medium tracking-tight md:mr-0 md:flex-1">
      {SITE_NAME}
    </Link>
  )
}

type HeaderProps = {
  lang: Locale
  dict: Dictionary
  active: AppSection
  variant?: "app" | "public"
  /** Where Create event goes; from My organizations it keeps that section (and the organization). */
  createHref?: string
  /** Section links on public pages, such as How it works and Pricing on the landing page. */
  sections?: { href: string; label: string }[]
}

/**
 * The bar on top of every page: for signed-in people Events and My organizations, language,
 * Create event and the account, also on public pages (an event, an organization), so they never
 * look signed out. On phones the sections live in the account menu.
 */
export function AppHeader(props: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        {props.variant === "public" ? (
          <Suspense fallback={<HeaderRow {...props} signedIn={false} />}>
            <PublicHeaderRow {...props} />
          </Suspense>
        ) : (
          <HeaderRow {...props} signedIn />
        )}
      </div>
    </header>
  )
}

/** Public pages read the session to decide which bar to show. */
async function PublicHeaderRow(props: HeaderProps) {
  return <HeaderRow {...props} signedIn={!!(await getSession())} />
}

function HeaderRow({ lang, dict, active, createHref, sections, signedIn }: HeaderProps & { signedIn: boolean }) {
  const t = dict.app
  const links = [
    { key: "events", href: `/${lang}/events`, label: t.events, icon: Ticket },
    { key: "organizations", href: `/${lang}/organizations`, label: t.organizations, icon: Users },
  ] as const
  return (
    <>
      <Logo href={signedIn ? `/${lang}/events` : `/${lang}`} />
      {signedIn && (
        <nav aria-label={t.events} className="hidden items-center gap-1 md:flex">
          {links.map(({ key, href, label, icon: Icon }) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={cn(active === key ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              aria-current={active === key ? "page" : undefined}
              asChild
            >
              <Link href={href}>
                <Icon />
                {label}
              </Link>
            </Button>
          ))}
        </nav>
      )}
      {!signedIn && sections && (
        <nav className="hidden items-center gap-1 md:flex">
          {sections.map((link) => (
            <Button key={link.href} variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <a href={link.href}>{link.label}</a>
            </Button>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-end gap-2 md:flex-1">
        <div className={signedIn ? "hidden md:block" : undefined}>
          <LanguageSwitcher lang={lang} label={dict.language} />
        </div>
        {signedIn && (
          <Button size="sm" className="max-md:size-8 max-md:px-0" aria-label={t.createEvent} asChild>
            <Link href={createHref ?? `/${lang}/events/new${active === "organizations" ? "?from=organizations" : ""}`}>
              <Plus />
              <span className="max-md:sr-only">{t.createEvent}</span>
            </Link>
          </Button>
        )}
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <Account lang={lang} dict={dict} />
        </Suspense>
      </div>
    </>
  )
}
