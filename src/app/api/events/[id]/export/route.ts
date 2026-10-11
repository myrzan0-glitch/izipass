import { getSession } from "@/lib/auth/session"
import { toCsv } from "@/lib/csv"
import { db } from "@/lib/db"
import { dictionaryFor } from "@/lib/i18n/all"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { getEventForMember } from "@/lib/organizers"
import { listEventRegistrations } from "@/lib/registrations"
import { slugify } from "@/lib/slug"
import { toLocalInput } from "@/lib/time"

const when = (date: Date | null) => (date ? toLocalInput(date).replace("T", " ") : "")

/** Attendee list for the organizer, as a spreadsheet-friendly CSV. */
export async function GET(request: Request, { params }: RouteContext<"/api/events/[id]/export">) {
  const session = await getSession()
  if (!session) return new Response(null, { status: 401 })
  const { id } = await params
  const event = (await getEventForMember(db(), session.userId, id))?.event
  if (!event) return new Response(null, { status: 404 })

  const langParam = new URL(request.url).searchParams.get("lang") ?? ""
  const dict = dictionaryFor(isLocale(langParam) ? langParam : DEFAULT_LOCALE)
  const t = dict.registrations
  const rows = await listEventRegistrations(db(), event.id)
  const csv = toCsv([
    [dict.register.name, dict.register.phone, dict.status.reference, dict.common.status, dict.register.note, t.registeredAt, t.decidedAt, t.checkedInAt, t.check],
    ...rows.map(({ registration: r, receipt }) => [
      r.name,
      r.phone,
      r.referenceCode,
      dict.registrationStatus[r.status],
      r.note,
      when(r.createdAt),
      when(r.decidedAt),
      when(r.checkedInAt),
      receipt?.verdict ? t.verdict[receipt.verdict] : "",
    ]),
  ])
  const name = `${slugify(event.title) || "event"}-${toLocalInput(event.startsAt).slice(0, 10)}.csv`
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  })
}
