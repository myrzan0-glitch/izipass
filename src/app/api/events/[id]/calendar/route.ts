import { calendarEventFor, icsFile } from "@/lib/calendar"
import { db } from "@/lib/db"
import { getPublicEventById } from "@/lib/events"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { SITE_URL } from "@/lib/site"
import { slugify } from "@/lib/slug"

/** "Add to calendar" file for a public event (Apple Calendar, Outlook, phones). */
export async function GET(request: Request, { params }: RouteContext<"/api/events/[id]/calendar">) {
  const { id } = await params
  const row = await getPublicEventById(db(), id)
  if (!row) return new Response(null, { status: 404 })
  const langParam = new URL(request.url).searchParams.get("lang") ?? ""
  const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE
  const ics = icsFile(calendarEventFor(row.event, row.organizer, lang, SITE_URL))
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(row.event.title) || "event"}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  })
}
