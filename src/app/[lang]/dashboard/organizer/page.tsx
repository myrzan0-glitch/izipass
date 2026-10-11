import { redirect } from "next/navigation"

/** Old address of the organizer settings: organizations now have their own pages. */
export default async function OldOrganizerPage({ params }: PageProps<"/[lang]/dashboard/organizer">) {
  const { lang } = await params
  redirect(`/${lang}/dashboard/organizations`)
}
