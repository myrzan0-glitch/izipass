"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Camera, CameraOff, CircleCheck, RefreshCw, Search } from "lucide-react"

import type { ScanTicket } from "@/app/api/events/[id]/tickets/route"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  const [search, setSearch] = useState("")
  const [list, setList] = useState<"out" | "in">("out")
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

  /** Takes back the last check-in: drops it from the queue, or tells the server. */
  const undo = useCallback(
    async (ticket: ScanTicket) => {
      const next = (tickets ?? []).map((x) => (x.id === ticket.id ? { ...x, checkedInAt: null } : x))
      setTickets(next)
      writeStorage(storageKey(eventId, "tickets"), next)
      const queue = readStorage<Pending[]>(storageKey(eventId, "pending")) ?? []
      const left = queue.filter((item) => item.token !== ticket.token)
      setPending(left)
      writeStorage(storageKey(eventId, "pending"), left)
      setResult(null)
      lastScan.current = { token: "", at: 0 }
      if (left.length === queue.length) {
        await fetch(`/api/events/${eventId}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ticket.token, undo: true }),
        }).catch(() => null)
      }
    },
    [tickets, eventId],
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

  const g = dict.guest
  const confirmedTickets = tickets?.filter((x) => x.status === "confirmed") ?? []
  const checkedIn = confirmedTickets.filter((x) => x.checkedInAt).length
  const confirmed = confirmedTickets.length
  const time = (iso: string) => new Intl.DateTimeFormat(lang, { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))
  const needle = search.trim().toLowerCase()
  const shown = confirmedTickets
    .filter((x) => (list === "in" ? !!x.checkedInAt : !x.checkedInAt))
    .filter((x) => !needle || x.name.toLowerCase().includes(needle) || x.reference.toLowerCase().includes(needle))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {fmt(g.inCount, { n: checkedIn, total: confirmed })}
        </Badge>
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

      <div className="relative overflow-hidden rounded-xl bg-primary text-primary-foreground">
        {cameraState === "on" ? (
          <>
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-1/4 top-1/2 aspect-square -translate-y-1/2 rounded-xl border-2 border-primary-foreground/80" />
            <Button variant="secondary" size="sm" className="absolute right-3 bottom-3" onClick={() => setCameraState("off")}>
              <CameraOff />
              {t.stop}
            </Button>
          </>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 p-6 text-center">
            <div aria-hidden className="size-28 rounded-xl border-2 border-primary-foreground/60" />
            <p className="max-w-xs text-sm text-primary-foreground/70">{cameraState === "error" ? t.cameraError : t.hint}</p>
            <Button variant="secondary" onClick={() => setCameraState("on")} disabled={!tickets}>
              <Camera />
              {t.start}
            </Button>
          </div>
        )}
      </div>

      {result && <ScanResult result={result} dict={dict} time={time} onUndo={undo} />}

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          // Enter on an exact code checks it in, like a scan.
          const exact = confirmedTickets.find((x) => x.reference.toLowerCase() === needle)
          if (exact || /^[a-z]+-\d+$/i.test(search.trim())) check(search)
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={g.findGuest}
          aria-label={t.manual}
          className="pl-9"
        />
      </form>

      <Tabs value={list} onValueChange={(v) => setList(v as "out" | "in")}>
        <TabsList className="w-full">
          <TabsTrigger value="out">
            {g.notIn}
            <span className="text-muted-foreground tabular-nums">{confirmed - checkedIn}</span>
          </TabsTrigger>
          <TabsTrigger value="in">
            {g.checkedIn}
            <span className="text-muted-foreground tabular-nums">{checkedIn}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{g.nobody}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((x, i) => (
            <li key={x.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.name}</p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {x.reference}
                    {x.checkedInAt && ` · ${time(x.checkedInAt)}`}
                  </p>
                </div>
                {!x.checkedInAt && (
                  <Button variant="outline" size="lg" onClick={() => check(x.token)}>
                    {g.checkIn}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">{fmt(t.eventLine, { title: eventTitle })}</p>
    </div>
  )
}

function ScanResult({ result, dict, time, onUndo }: { result: Result; dict: Dictionary; time: (iso: string) => string; onUndo: (ticket: ScanTicket) => void }) {
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
        <CircleCheck />
        <AlertTitle>{fmt(dict.guest.checkedInAlert, { name: ticket.name })}</AlertTitle>
        <AlertDescription className="flex w-full items-center justify-between gap-3">
          <span className="font-mono">{ticket.reference}</span>
          <Button variant="outline" size="sm" onClick={() => onUndo(ticket)}>
            {dict.guest.undo}
          </Button>
        </AlertDescription>
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
