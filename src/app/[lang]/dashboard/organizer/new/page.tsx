import { redirect } from "next/navigation"

/** Old address of "create organizer page". */
export default async function OldNewOrganizerPage({ params }: PageProps<"/[lang]/dashboard/organizer/new">) {
  const { lang } = await params
  redirect(`/${lang}/dashboard/organizations/new`)
}
