import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/dictionaries"
import { qrPath } from "@/lib/qr-path"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { formatWeekdayTime } from "@/lib/time"

// Inter with Latin and Cyrillic only (assets/fonts, OFL), so every language renders.
const fonts = Promise.all(
  (["Medium", "SemiBold"] as const).map(async (name, i) => ({
    name: "Inter",
    data: await readFile(join(process.cwd(), `assets/fonts/Inter-${name}.otf`)),
    weight: (i ? 600 : 500) as 500 | 600,
    style: "normal" as const,
  }))
)

// The image renderer can't read CSS variables, so these are the theme tokens from globals.css as hex.
const C = {
  background: "#fafafa",
  foreground: "#0a0a0a",
  muted: "#737373",
  light: "#fafafa",
  "chart-1": "#f54900",
  "chart-2": "#009689",
  "chart-3": "#104e64",
  "chart-4": "#ffb900",
  "chart-5": "#fe9a00",
}

const qr = qrPath(SITE_URL)
const qrSrc = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges"><path d="${qr.d}" fill="${C.foreground}"/></svg>`
)}`

type Pass = { org: string; title: string; meta: string; bg: string; dark: boolean; qr: boolean; style: React.CSSProperties }

function Pass({ pass }: { pass: Pass }) {
  const color = pass.dark ? C.foreground : C.light
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        width: 230,
        padding: 20,
        gap: 8,
        borderRadius: 22,
        background: pass.bg,
        color,
        boxShadow: "0 18px 36px -8px rgba(0,0,0,0.22)",
        ...pass.style,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.85 }}>{pass.org}</div>
      <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.15 }}>{pass.title}</div>
      <div style={{ fontSize: 15, opacity: 0.85 }}>{pass.meta}</div>
      {pass.qr && (
        <div style={{ display: "flex", marginTop: 6, padding: 9, borderRadius: 12, background: C.light, alignSelf: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn by the image renderer, not a browser */}
          <img src={qrSrc} width={80} height={80} alt="" />
        </div>
      )}
    </div>
  )
}

/** The share image for links to izipass (1200×630): the landing headline among Wallet passes. */
export async function GET(_request: Request, { params }: RouteContext<"/api/og/[lang]">) {
  const { lang: param } = await params
  const lang = isLocale(param) ? param : DEFAULT_LOCALE
  const l = (await getDictionary(lang)).landing
  const meta = (iso: string) => formatWeekdayTime(new Date(iso), lang)
  const passes: Pass[] = [
    { ...l.passes[0], meta: meta("2026-11-05T14:00:00Z"), bg: C["chart-1"], dark: false, qr: true, style: { left: 30, top: 44, transform: "rotate(-8deg)" } },
    { ...l.passes[1], meta: meta("2026-11-07T02:00:00Z"), bg: C["chart-2"], dark: false, qr: false, style: { left: 40, top: 418, transform: "rotate(6deg)" } },
    { ...l.passes[3], meta: meta("2026-11-13T04:00:00Z"), bg: C["chart-3"], dark: false, qr: true, style: { right: 30, top: 40, transform: "rotate(8deg)" } },
    { ...l.passes[5], meta: meta("2026-11-15T06:00:00Z"), bg: C["chart-4"], dark: true, qr: false, style: { right: 40, top: 418, transform: "rotate(-6deg)" } },
  ]

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", background: C.background, fontFamily: "Inter" }}>
        {passes.map((pass) => (
          <Pass key={pass.title} pass={pass} />
        ))}
        <div
          style={{
            position: "absolute",
            left: 270,
            right: 270,
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 26,
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 600, color: C.foreground, letterSpacing: -0.5 }}>{SITE_NAME}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: 70, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2.6 }}>
            <span style={{ color: C.foreground }}>{l.title}</span>
            <span
              style={{
                backgroundImage: `linear-gradient(90deg, ${C["chart-1"]}, ${C["chart-5"]} 55%, ${C["chart-4"]})`,
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {l.titleAccent}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: C.muted }}>{new URL(SITE_URL).host}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: await fonts,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    }
  )
}
