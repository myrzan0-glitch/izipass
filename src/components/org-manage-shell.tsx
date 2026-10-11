import Link from "next/link"
import { ArrowUpRight, ChevronRight, Plus } from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Organizer } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

export type OrgTab = "events" | "settings" | "payments" | "telegram"

/** One organization's pages in the app: its name, links, and the tabs. */
export function OrgManageShell({ lang, dict, organizer, tab, children }: { lang: Locale; dict: Dictionary; organizer: Organizer; tab: OrgTab; children: React.ReactNode }) {
  const base = `/${lang}/dashboard/organizations/${organizer.id}`
  const t = dict.orgs
  const tabs: { key: OrgTab; href: string }[] = [
    { key: "events", href: base },
    { key: "settings", href: `${base}/settings` },
    { key: "payments", href: `${base}/payments` },
    { key: "telegram", href: `${base}/telegram` },
  ]
  return (
    <DashboardShell lang={lang} dict={dict} active="organizations" width="wide">
      <div className="flex flex-col gap-4">
        <Link href={`/${lang}/dashboard/organizations`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {t.title}
          <ChevronRight className="size-4" />
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar className="size-12 rounded-lg">
            {organizer.logoUrl && <AvatarImage src={organizer.logoUrl} alt="" className="object-cover" />}
            <AvatarFallback className="rounded-lg bg-primary text-lg font-semibold text-primary-foreground">{organizer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight">{organizer.name}</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${lang}/o/${organizer.slug}`}>
              {t.publicPage}
              <ArrowUpRight />
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/${lang}/dashboard/events/new?org=${organizer.id}`}>
              <Plus />
              {dict.app.createEvent}
            </Link>
          </Button>
        </div>
        <Tabs value={tab}>
          <TabsList variant="line" className="w-full justify-start gap-4">
            {tabs.map(({ key, href }) => (
              <TabsTrigger key={key} value={key} className="flex-none" asChild>
                <Link href={href} scroll={false}>
                  {t.tabs[key]}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {children}
    </DashboardShell>
  )
}
