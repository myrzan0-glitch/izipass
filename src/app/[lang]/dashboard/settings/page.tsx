import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { deleteAccountAction, saveProfileAction } from "@/app/[lang]/dashboard/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { DashboardShell } from "@/components/dashboard-shell"
import { PageSkeleton } from "@/components/page-skeleton"
import { ProfileForm } from "@/components/profile-form"
import { SignInMethods } from "@/components/sign-in-methods"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth/current"
import { isLocale, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { TELEGRAM_BOT } from "@/lib/site"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/settings">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).settings.title, robots: { index: false } }
}

const ERRORS = ["emailTaken", "telegramTaken", "ownsOrganization"] as const

async function Content({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const user = await requireUser(lang, `/${lang}/dashboard/settings`)
  const t = dict.settings
  const error = ERRORS.find((e) => e === query.error)

  return (
    <DashboardShell lang={lang} dict={dict} width="narrow" title={t.title}>
      {query.saved === "1" && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t.saved}</AlertTitle>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t.errors[error]}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t.profileTitle}</CardTitle>
          <CardDescription>{t.profileHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm lang={lang} user={user} action={saveProfileAction} dict={dict} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.signInTitle}</CardTitle>
          <CardDescription>{t.signInHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInMethods
            lang={lang}
            telegram={user.telegramId ? (user.telegramUsername ? `@${user.telegramUsername}` : t.connected) : null}
            email={user.email}
            bot={TELEGRAM_BOT}
            dict={dict}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.signOutTitle}</CardTitle>
          <CardDescription>{t.signOutHint}</CardDescription>
          <CardAction>
            <form action="/api/auth/logout" method="post">
              <input type="hidden" name="lang" value={lang} />
              <Button type="submit" variant="outline">
                {dict.nav.signOut}
              </Button>
            </form>
          </CardAction>
        </CardHeader>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>{t.deleteTitle}</CardTitle>
          <CardDescription>{t.deleteHint}</CardDescription>
          <CardAction>
            <ConfirmAction
              action={deleteAccountAction}
              fields={{ lang }}
              trigger={t.deleteTitle}
              triggerVariant="destructive"
              triggerSize="default"
              title={t.deleteConfirmTitle}
              description={t.deleteConfirmBody}
              confirm={t.deleteTitle}
              cancel={dict.confirm.keep}
            />
          </CardAction>
        </CardHeader>
      </Card>
    </DashboardShell>
  )
}

export default async function SettingsPage({ params, searchParams }: PageProps<"/[lang]/dashboard/settings">) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content lang={lang} dict={dict} searchParams={searchParams} />
    </Suspense>
  )
}
