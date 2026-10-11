import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { getEventForMember } from "@/lib/organizers"
import { expireHolds, listEventRegistrations } from "@/lib/registrations"
import { ticketToken } from "@/lib/tickets"
import { notifyLater } from "@/lib/telegram/notify"

export type ScanTicket = {
  id: string
  token: string
  name: string
  reference: string
  status: string
  checkedInAt: string | null
}

/**
 * Everything the door scanner needs, so it can verify tickets without a
 * connection: each registration with the token its QR carries.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/events/[id]/tickets">) {
  const session = await getSession()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const event = (await getEventForMember(db(), session.userId, id))?.event
  if (!event) return Response.json({ error: "notFound" }, { status: 404 })

  await expireHolds(db(), event.id)
  notifyLater({ eventId: event.id })
  const rows = await listEventRegistrations(db(), event.id)
  const tickets: ScanTicket[] = rows.map(({ registration: r }) => ({
    id: r.id,
    token: ticketToken(r.id),
    name: r.name,
    reference: r.referenceCode,
    // On a cancelled event no ticket is valid; the scanner shows them as not confirmed.
    status: event.status === "cancelled" ? "cancelled" : r.status,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
  }))
  return Response.json({ event: { id: event.id, title: event.title, capacity: event.capacity }, tickets }, { headers: { "Cache-Control": "no-store" } })
}
