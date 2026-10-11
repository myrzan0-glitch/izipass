import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { setOrganizerCover } from "@/lib/images"
import { getMemberOrganizer } from "@/lib/organizers"
import { readImageUpload } from "@/lib/upload"

async function organizer(id: string) {
  const session = await getSession()
  return session ? getMemberOrganizer(db(), session.userId, id) : null
}

/** Organization settings: upload a new cover banner. */
export async function POST(request: Request, { params }: RouteContext<"/api/organizers/[id]/cover">) {
  const org = await organizer((await params).id)
  if (!org) return Response.json({ error: "notFound" }, { status: 404 })
  const upload = await readImageUpload(request)
  if ("error" in upload) return Response.json({ error: upload.error }, { status: upload.status })
  return Response.json(await setOrganizerCover(db(), org.id, upload.file))
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/organizers/[id]/cover">) {
  const org = await organizer((await params).id)
  if (!org) return Response.json({ error: "notFound" }, { status: 404 })
  return Response.json(await setOrganizerCover(db(), org.id, null))
}
