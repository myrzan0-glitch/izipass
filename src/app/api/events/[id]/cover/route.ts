import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { setCover } from "@/lib/images"
import { getEventForMember } from "@/lib/organizers"
import { readImageUpload } from "@/lib/upload"

/** The organization of the event, when the signed-in person is a member of it. */
async function organizer(eventId: string) {
  const session = await getSession()
  return session ? ((await getEventForMember(db(), session.userId, eventId))?.organizer ?? null) : null
}

/** Event page: upload a cover image (shown on the event page and in link previews). */
export async function POST(request: Request, { params }: RouteContext<"/api/events/[id]/cover">) {
  const { id } = await params
  const org = await organizer(id)
  if (!org) return Response.json({ error: "notFound" }, { status: 404 })
  const upload = await readImageUpload(request)
  if ("error" in upload) return Response.json({ error: upload.error }, { status: upload.status })
  const result = await setCover(db(), org.id, id, upload.file)
  return result ? Response.json(result) : Response.json({ error: "notFound" }, { status: 404 })
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/events/[id]/cover">) {
  const { id } = await params
  const org = await organizer(id)
  if (!org) return Response.json({ error: "notFound" }, { status: 404 })
  const result = await setCover(db(), org.id, id, null)
  return result ? Response.json(result) : Response.json({ error: "notFound" }, { status: 404 })
}
