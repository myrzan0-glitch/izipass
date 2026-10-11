import { Suspense } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CircleCheck } from "lucide-react"

import { saveOrganizerAction } from "@/app/[lang]/dashboard/actions"
import { ImageField } from "@/components/image-field"
import { OrgManageShell } from "@/components/org-manage-shell"
import { OrganizerForm } from "@/components/organizer-form"
import { PageSkeleton } from "@/components/page-skeleton"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { requireMemberOrganizer } from "@/lib/auth/current"
import { isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard/organizations/[id]/settings">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  return { title: (await getDictionary(lang)).orgs.settingsTitle, robots: { index: false } }
}

/** Organization → Settings: logo, cover, name, address, links and description. */
async function Content({ params, searchParams }: PageProps<"/[lang]/dashboard/organizations/[id]/settings">) {
  const { lang, id } = await params
  const query = await searchParams
  if (!isLocale(lang)) notFound()
  const dict = await getDictionary(lang)
  const { organizer } = await requireMemberOrganizer(lang, id, `/${lang}/dashboard/organizations/${id}/settings`)
  const t = dict.organizer

  return (
    <OrgManageShell lang={lang} dict={dict} organizer={organizer} tab="settings">
      {query.saved === "1" && (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t.saved}</AlertTitle>
        </Alert>
      )}
      <OrganizerForm
        lang={lang}
        organizer={organizer}
        action={saveOrganizerAction}
        dict={dict}
        aside={
          <>
            <ImageField
              endpoint={`/api/organizers/${organizer.id}/logo`}
              url={organizer.logoUrl}
              shape="square"
              label={t.logo}
              hint={t.logoHint}
              fallback={organizer.name.slice(0, 1).toUpperCase()}
              dict={dict}
            />
            <ImageField endpoint={`/api/organizers/${organizer.id}/cover`} url={organizer.coverUrl} shape="banner" label={dict.orgs.cover} hint={dict.orgs.coverHint} dict={dict} />
          </>
        }
      />
    </OrgManageShell>
  )
}

export default function OrganizationSettingsPage(props: PageProps<"/[lang]/dashboard/organizations/[id]/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  )
}
