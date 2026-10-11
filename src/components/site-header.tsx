import { Suspense } from "react"
import Link from "next/link"

import { AccountMenu } from "@/components/account-menu"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/auth/session"
import { getUser } from "@/lib/auth/users"
import { db } from "@/lib/db"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { SITE_NAME } from "@/lib/site"

/** Reads the session cookie, so it streams in while the rest of the page is static. */
async function AuthLink({ lang, dict }: { lang: Locale; dict: Dictionary["nav"] }) {
  const session = await getSession()
  const user = session ? await getUser(db(), session.userId) : null
  if (!user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${lang}/login`}>{dict.signIn}</Link>
      </Button>
    )
  }
  const detail = user.telegramUsername ? `@${user.telegramUsername}` : user.email
  return <AccountMenu lang={lang} name={user.name || user.email || "—"} detail={detail} dict={dict} />
}

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href={`/${lang}`} className="font-mono text-sm font-medium tracking-tight">
        {SITE_NAME}
      </Link>
      <nav className="flex items-center gap-1">
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <AuthLink lang={lang} dict={dict.nav} />
        </Suspense>
        <LanguageSwitcher lang={lang} label={dict.language} />
        <ModeToggle dict={dict.theme} />
      </nav>
    </header>
  )
}
