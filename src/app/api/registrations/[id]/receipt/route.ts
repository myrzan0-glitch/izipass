import { getSession } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { RegistrationError, attachReceipt, getRegistration } from "@/lib/registrations"

const MAX_BYTES = 2 * 1024 * 1024
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

/** Attendee uploads the receipt screenshot for their own registration. */
export async function POST(request: Request, { params }: RouteContext<"/api/registrations/[id]/receipt">) {
  const session = await getSession()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const row = await getRegistration(db(), id)
  if (!row || row.registration.userId !== session.userId) return Response.json({ error: "notFound" }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File) || !TYPES.has(file.type)) return Response.json({ error: "fileType" }, { status: 400 })
  if (file.size > MAX_BYTES) return Response.json({ error: "fileTooLarge" }, { status: 413 })

  try {
    const { registration, receiptId } = await attachReceipt(db(), id, file.type, Buffer.from(await file.arrayBuffer()))
    return Response.json({ status: registration.status, receiptId })
  } catch (error) {
    if (error instanceof RegistrationError) return Response.json({ error: `registration_${error.code}` }, { status: 409 })
    throw error
  }
}
