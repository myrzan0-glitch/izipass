import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { setCover } from "@/lib/images"
import { getOrganizerForUser } from "@/lib/organizers"
import { readImageUpload } from "@/lib/upload"

async function organizer() {
  const session = await getSession()
  return session ? getOrganizerForUser(db(), session.userId) : null
}

/** Event page: upload a cover image (shown on the event page and in link previews). */
export async function POST(request: Request, { params }: RouteContext<"/api/events/[id]/cover">) {
  const org = await organizer()
  if (!org) return Response.json({ error: "unauthorized" }, { status: 401 })
  const upload = await readImageUpload(request)
  if ("error" in upload) return Response.json({ error: upload.error }, { status: upload.status })
  const result = await setCover(db(), org.id, (await params).id, upload.file)
  return result ? Response.json(result) : Response.json({ error: "notFound" }, { status: 404 })
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/events/[id]/cover">) {
  const org = await organizer()
  if (!org) return Response.json({ error: "unauthorized" }, { status: 401 })
  const result = await setCover(db(), org.id, (await params).id, null)
  return result ? Response.json(result) : Response.json({ error: "notFound" }, { status: 404 })
}
