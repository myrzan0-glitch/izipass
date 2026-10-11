import { toString as qrSvg } from "qrcode"

import { AppleIcon, GoogleIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  lang: Locale
  registrationId: string
  qrValue: string
  name: string
  reference: string
  dict: Dictionary
  /** Extra actions under the wallet buttons (e.g. Add to calendar). */
  children?: React.ReactNode
}

/** The confirmed attendee's ticket: QR for the door plus Wallet buttons. */
export async function TicketCard({ lang, registrationId, qrValue, name, reference, dict, children }: Props) {
  const t = dict.ticket
  const svg = await qrSvg(qrValue, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dict.status.confirmedTitle}</CardTitle>
        <CardDescription>{t.qrHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="mx-auto w-full max-w-56 rounded-lg border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
          <img src={src} alt={t.qrAlt} className="aspect-square w-full" />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{dict.register.name}</dt>
          <dd className="text-right">{name}</dd>
          <dt className="text-muted-foreground">{dict.status.reference}</dt>
          <dd className="text-right font-mono font-semibold">{reference}</dd>
        </dl>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" asChild>
            <a href={`/api/tickets/${registrationId}/apple?lang=${lang}`}>
              <AppleIcon />
              {t.addApple}
            </a>
          </Button>
          <Button size="lg" asChild>
            <a href={`/api/tickets/${registrationId}/google?lang=${lang}`}>
              <GoogleIcon />
              {t.addGoogle}
            </a>
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
