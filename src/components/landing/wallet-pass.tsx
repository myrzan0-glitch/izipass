import type { CSSProperties } from "react"

import type { QrPath } from "@/lib/qr-path"
import { cn } from "@/lib/utils"

/** A shadcn chart color, or 0 for the primary color. */
export type PassTone = 0 | 1 | 2 | 3 | 4 | 5

export type PassData = { org: string; title: string; meta: string; tone: PassTone }

const TONE: Record<PassTone, string> = {
  0: "bg-primary",
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
}

/** Chart 4 and 5 are light colors, so their passes use dark text. */
export function isLightTone(tone: PassTone) {
  return tone === 4 || tone === 5
}

export function QrMark({ qr, className }: { qr: QrPath; className?: string }) {
  return (
    <svg viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" aria-hidden className={className}>
      <path d={qr.d} fill="currentColor" />
    </svg>
  )
}

/** A sample Wallet pass: the colored card the landing page shows around the headline. */
export function WalletPass({
  pass,
  qr,
  className,
  style,
}: {
  pass: PassData
  qr?: QrPath
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "flex w-42 flex-col gap-1.5 rounded-2xl p-3.5 shadow-lg",
        TONE[pass.tone],
        pass.tone === 0
          ? "text-primary-foreground"
          : isLightTone(pass.tone)
            ? "text-foreground dark:text-background"
            : "text-primary-foreground dark:text-foreground",
        className
      )}
    >
      <span className="text-[10px] font-semibold tracking-wider uppercase opacity-85">{pass.org}</span>
      <span className="text-base leading-tight font-semibold">{pass.title}</span>
      <span className="text-[11px] opacity-85">{pass.meta}</span>
      {qr && (
        <span className="mt-1 self-start rounded-lg bg-primary-foreground p-1.5 text-foreground dark:bg-foreground dark:text-background">
          <QrMark qr={qr} className="size-14" />
        </span>
      )}
    </div>
  )
}
