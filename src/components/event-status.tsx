import { Badge } from "@/components/ui/badge"
import type { EventStatus } from "@/lib/db/schema"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

const VARIANT: Record<EventStatus, "secondary" | "default" | "destructive"> = {
  draft: "secondary",
  published: "default",
  cancelled: "destructive",
}

export function EventStatusBadge({ status, dict }: { status: EventStatus; dict: Dictionary["event"]["status"] }) {
  return <Badge variant={VARIANT[status]}>{dict[status]}</Badge>
}
