import { Badge } from "@/components/ui/badge"
import type { RegistrationStatus } from "@/lib/db/schema"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

const VARIANT: Record<RegistrationStatus, "default" | "secondary" | "outline" | "destructive"> = {
  held: "secondary",
  proof_sent: "secondary",
  confirmed: "default",
  rejected: "destructive",
  expired: "outline",
  cancelled: "outline",
  waitlist: "outline",
}

export function RegistrationStatusBadge({ status, dict }: { status: RegistrationStatus; dict: Dictionary["registrationStatus"] }) {
  return <Badge variant={VARIANT[status]}>{dict[status]}</Badge>
}
