import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { setLogo } from "@/lib/images"
import { getOrganizerForUser } from "@/lib/organizers"
import { readImageUpload } from "@/lib/upload"

async function organizer() {
  const session = await getSession()
  return session ? getOrganizerForUser(db(), session.userId) : null
}

/** Organizer settings → Profile: upload a new logo. */
export async function POST(request: Request) {
  const org = await organizer()
  if (!org) return Response.json({ error: "unauthorized" }, { status: 401 })
  const upload = await readImageUpload(request)
  if ("error" in upload) return Response.json({ error: upload.error }, { status: upload.status })
  return Response.json(await setLogo(db(), org.id, upload.file))
}

export async function DELETE() {
  const org = await organizer()
  if (!org) return Response.json({ error: "unauthorized" }, { status: 401 })
  return Response.json(await setLogo(db(), org.id, null))
}
