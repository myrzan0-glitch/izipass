import { Badge } from "@/components/ui/badge"
import type { Event, EventStatus } from "@/lib/db/schema"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

/** What the organizer sees: a published event whose start has passed has "ended". */
export type DisplayStatus = EventStatus | "ended"

export function displayStatus(event: Pick<Event, "status" | "startsAt">, now: Date): DisplayStatus {
  return event.status === "published" && event.startsAt <= now ? "ended" : event.status
}

const VARIANT: Record<DisplayStatus, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  published: "default",
  cancelled: "destructive",
  ended: "outline",
}

export function EventStatusBadge({ status, dict }: { status: DisplayStatus; dict: Dictionary["event"]["status"] }) {
  return <Badge variant={VARIANT[status]}>{dict[status]}</Badge>
}
