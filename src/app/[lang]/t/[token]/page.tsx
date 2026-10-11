import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin } from "lucide-react"

import { PageSkeleton } from "@/components/page-skeleton"
import { SiteHeader } from "@/components/site-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { getRegistration } from "@/lib/registrations"
import { parseTicketToken } from "@/lib/tickets"
import { formatDateTime } from "@/lib/time"

export async function generateMetadata({ params }: PageProps<"/[lang]/t/[token]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).ticket.title, robots: { index: false } }
}

/**
 * What a phone camera opens when it scans the ticket's QR. Signed, so it
 * can't be guessed; the door scanner (next step) checks the same token.
 */
async function Content({ params }: { params: PageProps<"/[lang]/t/[token]">["params"] }) {
  const { lang, token } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const id = parseTicketToken(token)
  const row = id ? await getRegistration(db(), id) : null
  if (!row) notFound()
  const { registration: reg, event, organizer } = row
  const t = dict.ticket
  const cancelled = event.status === "cancelled"
  const state = cancelled ? "invalid" : reg.checkedInAt ? "checkedIn" : reg.status === "confirmed" ? "valid" : "invalid"

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:py-12">
      <SiteHeader lang={lang} dict={dict} />
      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardHeader>
            <CardDescription>{organizer.name}</CardDescription>
            <CardTitle className="text-xl">{event.title}</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {formatDateTime(event.startsAt, lang)}
            </CardDescription>
            {event.venue && (
              <CardDescription className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {event.venue}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {state === "valid" && (
              <Alert>
                <AlertTitle>{t.valid}</AlertTitle>
                <AlertDescription>{t.validHint}</AlertDescription>
              </Alert>
            )}
            {state === "checkedIn" && (
              <Alert>
                <AlertTitle>{t.checkedIn}</AlertTitle>
                <AlertDescription>{formatDateTime(reg.checkedInAt!, lang)}</AlertDescription>
              </Alert>
            )}
            {state === "invalid" && (
              <Alert variant="destructive">
                <AlertTitle>{t.invalid}</AlertTitle>
                <AlertDescription>{cancelled ? t.eventCancelled : dict.registrationStatus[reg.status]}</AlertDescription>
              </Alert>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{dict.register.name}</dt>
              <dd className="text-right">{reg.name}</dd>
              <dt className="text-muted-foreground">{dict.status.reference}</dt>
              <dd className="text-right font-mono font-semibold">{reg.referenceCode}</dd>
              <dt className="text-muted-foreground">{dict.common.status}</dt>
              <dd className="text-right">
                <Badge variant={state === "invalid" ? "destructive" : "default"}>{dict.registrationStatus[reg.status]}</Badge>
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function Page({ params }: PageProps<"/[lang]/t/[token]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
