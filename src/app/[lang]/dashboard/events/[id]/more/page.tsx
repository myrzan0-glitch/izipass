import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CircleCheck, Copy, Settings } from "lucide-react"

import { deleteDraftAction, duplicateEventAction, saveEventSlugAction, setEventStatusAction } from "@/app/[lang]/dashboard/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { EventManageShell } from "@/components/event-manage-shell"
import { EventSlugForm } from "@/components/event-slug-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { requireEventAccess } from "@/lib/auth/current"
import { db } from "@/lib/db"
import { displayStatus } from "@/components/event-status"
import { liveRegistrationCount } from "@/lib/events"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { registrationCounts } from "@/lib/registrations"
import { SITE_URL } from "@/lib/site"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/events/[id]/more">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).manage.tabs.more, robots: { index: false } }
}

/** Manage event → More: duplicate, the event link, its organization, and the danger zone. */
async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/events/[id]/more">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { event, organizer } = await requireEventAccess(lang, id, `/${lang}/dashboard/events/${id}/more`)
  const [counts, live] = await Promise.all([registrationCounts(db(), [event.id]).then((m) => m.get(event.id)), liveRegistrationCount(db(), event.id)])
  const t = dict.manage
  const error = typeof query.error === "string" ? dict.errors[query.error as keyof Dictionary["errors"]] : undefined
  const host = new URL(SITE_URL).host

  const dangerRow = (title: string, hint: string, action: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {action}
    </div>
  )

  return (
    <EventManageShell lang={lang} dict={dict} event={event} organizer={organizer} tab="more" review={counts?.review ?? 0}>
      {query.saved === "1" && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t.saved}</AlertTitle>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{fmt(error, { n: live })}</AlertDescription>
        </Alert>
      )}
      <div className="flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.duplicateTitle}</CardTitle>
            <CardDescription>{t.duplicateHint}</CardDescription>
            <CardAction>
              <form action={duplicateEventAction}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="eventId" value={event.id} />
                <Button type="submit" variant="outline">
                  <Copy />
                  {dict.event.duplicate}
                </Button>
              </form>
            </CardAction>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.linkTitle}</CardTitle>
            <CardDescription>{t.linkHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <EventSlugForm
              lang={lang}
              eventId={event.id}
              slug={event.slug}
              prefix={`${host}/o/${organizer.slug}/`}
              action={saveEventSlugAction}
              dict={dict}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.organizationTitle}</CardTitle>
            <CardDescription>{organizer.name}</CardDescription>
            <CardAction>
              <Button variant="outline" asChild>
                <Link href={`/${lang}/dashboard/organizations/${organizer.id}`}>
                  <Settings />
                  {dict.orgs.settings}
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
        </Card>

        <section aria-labelledby="danger" className="flex flex-col gap-3">
          <h2 id="danger" className="text-lg font-semibold text-destructive">
            {t.dangerTitle}
          </h2>
          <Card className="gap-0 border-destructive/30 py-0">
            {dangerRow(
              t.draftTitle,
              event.status === "published" && live > 0 ? t.liveLocked : t.draftHint,
              <form action={setEventStatusAction}>
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="status" value="draft" />
                <input type="hidden" name="returnTo" value="more" />
                <Button type="submit" variant="outline" disabled={event.status !== "published" || live > 0}>
                  {t.unpublishButton}
                </Button>
              </form>,
            )}
            <Separator className="bg-destructive/30" />
            {dangerRow(
              dict.event.cancel,
              fmt(t.cancelHint, { n: live }),
              <ConfirmAction
                action={setEventStatusAction}
                fields={{ lang, eventId: event.id, status: "cancelled", returnTo: "more" }}
                trigger={dict.event.cancel}
                triggerVariant="destructive"
                triggerSize="default"
                disabled={displayStatus(event, new Date()) !== "published"}
                title={dict.confirm.cancelEventTitle}
                description={dict.confirm.cancelEventBody}
                confirm={dict.confirm.cancelEventConfirm}
                cancel={dict.confirm.keep}
              />,
            )}
            <Separator className="bg-destructive/30" />
            {dangerRow(
              t.deleteTitle,
              t.deleteHint,
              <ConfirmAction
                action={deleteDraftAction}
                fields={{ lang, eventId: event.id }}
                trigger={t.deleteButton}
                triggerVariant="outline"
                triggerSize="default"
                disabled={event.status !== "draft" || live > 0}
                title={dict.event.deleteTitle}
                description={dict.event.deleteBody}
                confirm={dict.event.deleteDraft}
                cancel={dict.confirm.keep}
              />,
            )}
          </Card>
        </section>
      </div>
    </EventManageShell>
  )
}

export default function MorePage(props: PageProps<"/[lang]/dashboard/events/[id]/more">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
