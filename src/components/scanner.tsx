"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Camera, CameraOff, RefreshCw } from "lucide-react"

import type { ScanTicket } from "@/app/api/events/[id]/tickets/route"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { detectQr } from "@/lib/client/detect"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

type Props = { lang: Locale; eventId: string; eventTitle: string; dict: Dictionary }

type Pending = { token: string; at: string }
type Result =
  | { kind: "ok"; ticket: ScanTicket }
  | { kind: "already"; ticket: ScanTicket; at: string }
  | { kind: "notConfirmed"; ticket: ScanTicket }
  | { kind: "unknown"; value: string }

const storageKey = (eventId: string, what: "tickets" | "pending") => `izipass:scan:${eventId}:${what}`

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable (private mode); the page still works for this session.
  }
}

/** Token from whatever the QR contains: the full ticket URL or a bare token. */
function tokenOf(value: string) {
  const match = value.trim().match(/\/t\/([^/?#\s]+)/)
  return (match ? match[1] : value.trim()).split("/").pop() ?? ""
}

/**
 * Door check-in. Loads every ticket of the event once, so scans are
 * verified on the phone even without a connection; check-ins are queued
 * and synced when online.
 */
export function Scanner({ lang, eventId, eventTitle, dict }: Props) {
  const t = dict.scan
  const videoRef = useRef<HTMLVideoElement>(null)
  const [tickets, setTickets] = useState<ScanTicket[] | null>(() => readStorage<ScanTicket[]>(storageKey(eventId, "tickets")))
  const [pending, setPending] = useState<Pending[]>(() => readStorage<Pending[]>(storageKey(eventId, "pending")) ?? [])
  const [loadError, setLoadError] = useState(false)
  const [cameraState, setCameraState] = useState<"off" | "on" | "error">("off")
  const [result, setResult] = useState<Result | null>(null)
  const [manual, setManual] = useState("")
  const online = useOnline()
  const lastScan = useRef<{ token: string; at: number }>({ token: "", at: 0 })

  // --- data ---------------------------------------------------------------

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/tickets`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { tickets: ScanTicket[] }
      setTickets(data.tickets)
      writeStorage(storageKey(eventId, "tickets"), data.tickets)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [eventId])

  const sync = useCallback(async () => {
    const queue = readStorage<Pending[]>(storageKey(eventId, "pending")) ?? []
    if (queue.length === 0 || !navigator.onLine) return
    const remaining: Pending[] = []
    for (const item of queue) {
      try {
        const res = await fetch(`/api/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        })
        // 4xx answers are final (invalid or not confirmed); only network/5xx stay queued.
        if (res.status >= 500) remaining.push(item)
      } catch {
        remaining.push(item)
      }
    }
    setPending(remaining)
    writeStorage(storageKey(eventId, "pending"), remaining)
    if (remaining.length < queue.length) load()
  }, [eventId, load])

  // Initial load after mount; queued check-ins are pushed whenever the connection returns.
  useEffect(() => {
    queueMicrotask(() => {
      load().then(sync)
    })
    const onOnline = () => sync()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [load, sync])

  // --- checking a ticket --------------------------------------------------

  const check = useCallback(
    (raw: string) => {
      const token = tokenOf(raw)
      const now = Date.now()
      if (token === lastScan.current.token && now - lastScan.current.at < 4000) return
      lastScan.current = { token, at: now }
      if (navigator.vibrate) navigator.vibrate(60)

      const ticket = tickets?.find((x) => x.token === token || x.reference.toLowerCase() === token.toLowerCase())
      if (!ticket) return setResult({ kind: "unknown", value: raw })
      if (ticket.checkedInAt) return setResult({ kind: "already", ticket, at: ticket.checkedInAt })
      if (ticket.status !== "confirmed") return setResult({ kind: "notConfirmed", ticket })

      const at = new Date().toISOString()
      const updated = { ...ticket, checkedInAt: at }
      const next = tickets!.map((x) => (x.id === ticket.id ? updated : x))
      setTickets(next)
      writeStorage(storageKey(eventId, "tickets"), next)
      const queue = [...(readStorage<Pending[]>(storageKey(eventId, "pending")) ?? []), { token: ticket.token, at }]
      setPending(queue)
      writeStorage(storageKey(eventId, "pending"), queue)
      setResult({ kind: "ok", ticket: updated })
      sync()
    },
    [tickets, eventId, sync],
  )

  // --- camera -------------------------------------------------------------

  useEffect(() => {
    if (cameraState !== "on") return
    let stream: MediaStream | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const scan = async () => {
      const video = videoRef.current
      if (stopped || !video) return
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        const value = await detectQr(video).catch(() => null)
        if (value && !stopped) check(value)
      }
      timer = setTimeout(scan, 250)
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        stream = s
        if (stopped || !videoRef.current) return
        videoRef.current.srcObject = s
        await videoRef.current.play()
        scan()
      })
      .catch(() => setCameraState("error"))
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraState, check])

  const checkedIn = tickets?.filter((x) => x.checkedInAt).length ?? 0
  const confirmed = tickets?.filter((x) => x.status === "confirmed").length ?? 0
  const time = (iso: string) => new Intl.DateTimeFormat(lang, { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{fmt(t.counter, { n: checkedIn, total: confirmed })}</Badge>
        {!online && <Badge variant="outline">{t.offline}</Badge>}
        {pending.length > 0 && <Badge variant="outline">{fmt(t.pendingSync, { n: pending.length })}</Badge>}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => load().then(sync)} disabled={!online}>
          <RefreshCw />
          {t.refresh}
        </Button>
      </div>

      {loadError && !tickets && (
        <Alert variant="destructive">
          <AlertTitle>{t.loadError}</AlertTitle>
        </Alert>
      )}

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          {cameraState === "on" ? (
            <div className="relative bg-black">
              <video ref={videoRef} className="aspect-[3/4] w-full object-cover sm:aspect-video" muted playsInline />
              <div className="pointer-events-none absolute inset-x-12 top-1/2 aspect-square -translate-y-1/2 rounded-lg border-2 border-white/80 sm:inset-x-1/3" />
              <Button variant="secondary" size="sm" className="absolute right-3 bottom-3" onClick={() => setCameraState("off")}>
                <CameraOff />
                {t.stop}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">{cameraState === "error" ? t.cameraError : t.hint}</p>
              <Button size="lg" onClick={() => setCameraState("on")} disabled={!tickets}>
                <Camera />
                {t.start}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {result && <ScanResult result={result} dict={dict} time={time} />}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) check(manual)
          setManual("")
        }}
      >
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t.manualPlaceholder} aria-label={t.manual} autoCapitalize="characters" />
        <Button type="submit" variant="outline" disabled={!tickets}>
          {t.check}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{fmt(t.eventLine, { title: eventTitle })}</p>
    </div>
  )
}

function ScanResult({ result, dict, time }: { result: Result; dict: Dictionary; time: (iso: string) => string }) {
  const t = dict.scan
  if (result.kind === "unknown") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t.unknown}</AlertTitle>
        <AlertDescription className="break-all">{result.value.slice(0, 80)}</AlertDescription>
      </Alert>
    )
  }
  const { ticket } = result
  const detail = `${ticket.name} · ${ticket.reference}`
  if (result.kind === "ok") {
    return (
      <Alert>
        <AlertTitle className="text-lg">✓ {t.ok}</AlertTitle>
        <AlertDescription>{detail}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert variant="destructive">
      <AlertTitle className="text-lg">
        {result.kind === "already" ? fmt(t.already, { time: time(result.at) }) : `${t.notConfirmed}: ${dict.registrationStatus[ticket.status as keyof Dictionary["registrationStatus"]]}`}
      </AlertTitle>
      <AlertDescription>{detail}</AlertDescription>
    </Alert>
  )
}
