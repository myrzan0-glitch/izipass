import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getSession } from "@/lib/auth/session"
import { safeNext } from "@/lib/auth/tokens"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { TELEGRAM_BOT } from "@/lib/site"
import { isTestStand } from "@/lib/test-stand"

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).login.title, robots: { index: false } }
}

type Query = PageProps<"/[lang]/login">["searchParams"]

/** Depends on the query string and the session cookie, so it streams in. */
async function LoginCard({ lang, searchParams, dict }: { lang: Locale; searchParams: Query; dict: Dictionary["login"] }) {
  const query = await searchParams
  const next = safeNext(typeof query.next === "string" ? query.next : null, `/${lang}/events`)
  if (await getSession()) redirect(next)
  const testStand = isTestStand() ? (await getDictionary(lang)).testStand : null

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{dict.title}</CardTitle>
        <CardDescription>{dict.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm
          lang={lang}
          next={next}
          bot={TELEGRAM_BOT}
          initialError={typeof query.error === "string" ? query.error : undefined}
          dict={dict}
          testStand={testStand ?? undefined}
        />
      </CardContent>
    </Card>
  )
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/login">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 pt-8 pb-16 sm:pt-12">
        <div className="flex flex-1 items-start justify-center">
          <Suspense fallback={<Skeleton className="h-72 w-full max-w-sm" />}>
            <LoginCard lang={lang} searchParams={searchParams} dict={dict.login} />
          </Suspense>
        </div>
      </main>
    </>
  )
}
