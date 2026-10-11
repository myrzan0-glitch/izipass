import { Suspense } from "react"
import { redirect } from "next/navigation"

type Props = PageProps<"/[lang]/dashboard/[[...rest]]">

/** Where an old /dashboard/… address lives now. */
function newPath(rest: string[]) {
  const [section, id, tab] = rest
  if (!section) return "events"
  if (section === "organizer") return id === "new" ? "organizations/new" : "organizations"
  if (section === "events" && tab === "registrations") return `events/${id}/guests`
  return rest.join("/")
}

async function Redirect({ params, searchParams }: Props) {
  const { lang, rest = [] } = await params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") query.set(key, value)
  const qs = query.toString()
  redirect(`/${lang}/${newPath(rest.map(encodeURIComponent))}${qs ? `?${qs}` : ""}`)
  return null
}

/** Old /dashboard links (bookmarks, Telegram messages) keep working. */
export default function OldDashboard(props: Props) {
  return (
    <Suspense>
      <Redirect {...props} />
    </Suspense>
  )
}
