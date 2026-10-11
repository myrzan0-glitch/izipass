import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, ScanLine, Users } from "lucide-react"

import { saveEventAction, setEventStatusAction } from "@/app/[lang]/dashboard/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { DashboardShell } from "@/components/dashboard-shell"
import { EventForm } from "@/components/event-form"
import { EventStatusBadge } from "@/components/event-status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageSkeleton } from "@/components/page-skeleton"
import { ShareLink } from "@/components/share-link"
import { requireOrganizer } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { getEvent, planLimits } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { SITE_URL } from "@/lib/site"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).event.editTitle, robots: { index: false } }
}

async function Content({ params }: { params: PageProps<"/[lang]/dashboard/events/[id]">["params"] }) {
  const { lang, id } = await params
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { organizer } = await requireOrganizer(lang, `/${lang}/dashboard/events/${id}`)
  const event = await getEvent(db(), organizer.id, id)
  if (!event) notFound()
  const t = dict.event
  const publicUrl = `/${lang}/o/${organizer.slug}/${event.slug}`

  const statusForm = (status: "draft" | "published" | "cancelled", label: string, variant: "default" | "outline" | "destructive") => (
    <form action={setEventStatusAction}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  )

  return (
    <DashboardShell
      lang={lang}
      dict={dict}
      title={event.title}
      back={{ href: `/${lang}/dashboard`, label: dict.nav.dashboard }}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${lang}/dashboard/events/${event.id}/registrations`}>
              <Users />
              {dict.registrations.title}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${lang}/dashboard/events/${event.id}/scan`}>
              <ScanLine />
              {dict.scan.title}
            </Link>
          </Button>
          <EventStatusBadge status={event.status} dict={t.status} />
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>{t.publishing}</CardTitle>
          <CardDescription>{t.publishingHint[event.status]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {event.status === "draft" && statusForm("published", t.publish, "default")}
          {event.status === "published" && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={publicUrl}>
                  <ExternalLink />
                  {t.openPublicPage}
                </Link>
              </Button>
              {statusForm("draft", t.unpublish, "outline")}
              <ConfirmAction
                action={setEventStatusAction}
                fields={{ lang, eventId: event.id, status: "cancelled" }}
                trigger={t.cancel}
                triggerVariant="destructive"
                title={dict.confirm.cancelEventTitle}
                description={dict.confirm.cancelEventBody}
                confirm={dict.confirm.cancelEventConfirm}
                cancel={dict.confirm.keep}
              />
            </>
          )}
          {event.status === "cancelled" && statusForm("draft", t.restore, "outline")}
        </CardContent>
        {event.status === "published" && (
          <CardContent className="flex flex-col gap-2 border-t pt-6">
            <p className="text-sm font-medium">{dict.share.title}</p>
            <p className="text-sm text-muted-foreground">{dict.share.hint}</p>
            <ShareLink url={`${SITE_URL}${publicUrl}`} title={event.title} dict={dict.share} />
          </CardContent>
        )}
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t.editTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            lang={lang}
            event={event}
            organizerSlug={organizer.slug}
            maxCapacity={planLimits(organizer).participantsPerEvent}
            action={saveEventAction}
            dict={dict}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}

export default function EditEventPage({ params }: PageProps<"/[lang]/dashboard/events/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  )
}
