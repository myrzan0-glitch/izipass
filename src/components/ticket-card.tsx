import { toString as qrSvg } from "qrcode"
import { Check } from "lucide-react"

import { AppleIcon, GoogleIcon } from "@/components/brand-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

type Props = {
  lang: Locale
  registrationId: string
  qrValue: string
  name: string
  reference: string
  /** Event title and "Thu 5 Nov, 19:00 – 21:00 · Bon! cafe". */
  title: string
  when: string
  dict: Dictionary
}

/** The confirmed guest's ticket: QR for the door plus Wallet buttons. */
export async function TicketCard({ lang, registrationId, qrValue, name, reference, title, when, dict }: Props) {
  const t = dict.ticket
  const svg = await qrSvg(qrValue, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

  return (
    <Card>
      <CardHeader className="justify-items-center text-center">
        <Badge>
          <Check />
          {dict.guest.approved}
        </Badge>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{when}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <div className="w-full max-w-52 rounded-lg border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
          <img src={src} alt={t.qrAlt} className="aspect-square w-full" />
        </div>
        <p className="font-mono font-medium">{reference}</p>
        <p className="text-sm text-muted-foreground">{fmt(dict.guest.atDoor, { name })}</p>
      </CardContent>
      <CardContent className="flex flex-col gap-2">
        <Button size="lg" asChild>
          <a href={`/api/tickets/${registrationId}/apple?lang=${lang}`}>
            <AppleIcon />
            {t.addApple}
          </a>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <a href={`/api/tickets/${registrationId}/google?lang=${lang}`}>
            <GoogleIcon />
            {t.addGoogle}
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
