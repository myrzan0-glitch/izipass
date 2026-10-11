import { z } from "zod"

import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { getEventForMember } from "@/lib/organizers"
import { CheckInError, checkIn, undoCheckIn } from "@/lib/registrations"
import { parseTicketToken } from "@/lib/tickets"

const bodySchema = z.object({
  token: z.string().min(1).max(120),
  /** When the scan happened on the device (offline scans are synced later). */
  at: z.iso.datetime().optional(),
  undo: z.boolean().optional(),
})

/** Records a check-in from the door scanner. Safe to retry. */
export async function POST(request: Request, { params }: RouteContext<"/api/events/[id]/checkin">) {
  const session = await getSession()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const event = (await getEventForMember(db(), session.userId, id))?.event
  if (!event) return Response.json({ error: "notFound" }, { status: 404 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 })
  const registrationId = parseTicketToken(parsed.data.token)
  if (!registrationId) return Response.json({ error: "invalid_token" }, { status: 400 })

  if (parsed.data.undo) {
    const reg = await undoCheckIn(db(), event.id, registrationId)
    return reg ? Response.json({ ok: true }) : Response.json({ error: "notFound" }, { status: 404 })
  }

  try {
    const at = parsed.data.at ? new Date(parsed.data.at) : new Date()
    const result = await checkIn(db(), event.id, registrationId, session.userId, at)
    return Response.json({
      ok: true,
      already: result.already,
      checkedInAt: result.registration.checkedInAt?.toISOString(),
      name: result.registration.name,
      reference: result.registration.referenceCode,
    })
  } catch (error) {
    if (error instanceof CheckInError) return Response.json({ error: error.code }, { status: error.code === "notFound" ? 404 : 409 })
    throw error
  }
}
