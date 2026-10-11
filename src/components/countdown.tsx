"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Timer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { fmt } from "@/lib/i18n/format"

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}

/** "29:41 left to pay", live; refreshes the page when the hold runs out. */
export function Countdown({ deadline, label, done }: { deadline: string; label: string; done: string }) {
  const router = useRouter()
  const end = new Date(deadline).getTime()
  // Seconds left, re-read every second; null on the server (no clock in the HTML).
  const left = useSyncExternalStore(
    subscribe,
    () => Math.max(0, Math.round((end - Date.now()) / 1000)),
    () => null,
  )
  const [refreshed, setRefreshed] = useState(false)
  useEffect(() => {
    if (left !== 0 || refreshed) return
    const id = setTimeout(() => {
      setRefreshed(true)
      router.refresh()
    }, 1500)
    return () => clearTimeout(id)
  }, [left, refreshed, router])

  if (left === null) return null
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, "0")
  const time = mm >= 60 ? `${Math.floor(mm / 60)}:${String(mm % 60).padStart(2, "0")}:${ss}` : `${mm}:${ss}`
  return (
    <Badge variant={left > 0 && left < 300 ? "destructive" : "secondary"} className="tabular-nums" aria-live="off">
      <Timer />
      {left > 0 ? fmt(label, { time }) : done}
    </Badge>
  )
}
