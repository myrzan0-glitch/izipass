import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { getEventForMember } from "@/lib/organizers"
import { getReceipt } from "@/lib/registrations"

/** Receipt image: visible to the attendee who uploaded it and to the event's organizer. */
export async function GET(_request: Request, { params }: RouteContext<"/api/receipts/[id]">) {
  const session = await getSession()
  if (!session) return new Response(null, { status: 401 })
  const { id } = await params
  const row = await getReceipt(db(), id)
  if (!row) return new Response(null, { status: 404 })

  let allowed = row.registration.userId === session.userId
  if (!allowed) allowed = !!(await getEventForMember(db(), session.userId, row.registration.eventId))
  if (!allowed) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(row.receipt.data), {
    headers: { "Content-Type": row.receipt.contentType, "Cache-Control": "private, no-store", "Content-Disposition": "inline" },
  })
}
