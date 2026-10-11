import { Suspense } from "react"
import { redirect } from "next/navigation"

type Props = PageProps<"/[lang]/dashboard/events/[id]/registrations">

async function Redirect({ params, searchParams }: Props) {
  const { lang, id } = await params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") query.set(key, value)
  const qs = query.toString()
  redirect(`/${lang}/dashboard/events/${id}/guests${qs ? `?${qs}` : ""}`)
  return null
}

/** Old address of the guest list (older Telegram messages link here). */
export default function OldRegistrationsPage(props: Props) {
  return (
    <Suspense>
      <Redirect {...props} />
    </Suspense>
  )
}
