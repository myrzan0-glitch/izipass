import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { RegistrationError, getReceipt, recordReceiptText } from "@/lib/registrations"
import { notifyLater } from "@/lib/telegram/notify"

const MAX_CHARS = 20_000

/**
 * The attendee's browser read their receipt with OCR; this stores the text
 * and runs the organizer's auto-check on it. Only the owner can send it, and
 * only once per receipt.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/receipts/[id]/text">) {
  const session = await getSession()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const row = await getReceipt(db(), id)
  if (!row || row.registration.userId !== session.userId) return Response.json({ error: "notFound" }, { status: 404 })
  if (row.receipt.checkedAt) return Response.json({ error: "registration_badState" }, { status: 409 })

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null
  const text = typeof body?.text === "string" ? body.text.slice(0, MAX_CHARS) : ""
  if (!text.trim()) return Response.json({ error: "invalid" }, { status: 400 })

  try {
    const result = await recordReceiptText(db(), id, text)
    notifyLater({ receiptId: id, eventId: row.registration.eventId })
    return Response.json(result ?? { verdict: null, status: row.registration.status })
  } catch (error) {
    if (error instanceof RegistrationError) return Response.json({ error: `registration_${error.code}` }, { status: 409 })
    throw error
  }
}
