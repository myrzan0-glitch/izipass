import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/auth/session"
import { getUser } from "@/lib/auth/users"
import { db } from "@/lib/db"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).dashboard.title, robots: { index: false } }
}

/** Everything that depends on the signed-in user; the shell around it is static. */
async function Dashboard({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const session = await getSession()
  if (!session) redirect(`/${lang}/login?next=/${lang}/dashboard`)
  const user = await getUser(db(), session.userId)
  if (!user) redirect(`/${lang}/login`)
  const name = user.name || user.email || user.telegramUsername || ""

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">{fmt(dict.dashboard.welcome, { name })}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{dict.dashboard.account}</CardTitle>
            <CardDescription>{dict.dashboard.noOrganizer}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{dict.dashboard.email}</span>
              {user.email ? <span>{user.email}</span> : <Badge variant="outline">{dict.dashboard.notLinked}</Badge>}
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{dict.dashboard.telegram}</span>
              {user.telegramId ? (
                <span>{user.telegramUsername ? `@${user.telegramUsername}` : user.telegramId}</span>
              ) : (
                <Badge variant="outline">{dict.dashboard.notLinked}</Badge>
              )}
            </div>
            <form action="/api/auth/logout" method="post" className="pt-2">
              <input type="hidden" name="lang" value={lang} />
              <Button type="submit" variant="outline" size="sm">
                {dict.nav.signOut}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default async function DashboardPage({ params }: PageProps<"/[lang]/dashboard">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-48 w-full md:w-1/2" />
          </div>
        }
      >
        <Dashboard lang={lang} dict={dict} />
      </Suspense>
    </main>
  )
}
