/**
 * "Add to calendar": an .ics file (Apple Calendar, Outlook, most phones) and
 * a Google Calendar link. Events without an end get two hours.
 */
export type CalendarEvent = {
  id: string
  title: string
  startsAt: Date
  endsAt: Date | null
  venue: string
  url: string
  description: string
}

const DEFAULT_LENGTH_MS = 2 * 3_600_000
const end = (e: CalendarEvent) => e.endsAt ?? new Date(e.startsAt.getTime() + DEFAULT_LENGTH_MS)
/** 20261105T140000Z */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1")
}

/** RFC 5545 folding: lines over 75 octets continue on the next line after a space. */
function fold(line: string) {
  const bytes = new TextEncoder()
  const out: string[] = []
  let current = ""
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current)
      current = ch
    } else current += ch
  }
  out.push(current)
  return out.join("\r\n ")
}

export function icsFile(e: CalendarEvent, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//izipass//events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@izipass`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(end(e))}`,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.venue ? [`LOCATION:${escapeText(e.venue)}`] : []),
    `DESCRIPTION:${escapeText([e.description, e.url].filter(Boolean).join("\n\n"))}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

export function googleCalendarUrl(e: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.startsAt)}/${stamp(end(e))}`,
    details: [e.description, e.url].filter(Boolean).join("\n\n").slice(0, 1500),
    location: e.venue,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** The calendar entry for an izipass event, pointing back to its public page. */
export function calendarEventFor(
  event: { id: string; title: string; startsAt: Date; endsAt: Date | null; venue: string; slug: string },
  organizer: { slug: string; name: string },
  lang: string,
  siteUrl: string,
): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venue: event.venue,
    url: `${siteUrl}/${lang}/o/${organizer.slug}/${event.slug}`,
    description: organizer.name,
  }
}
