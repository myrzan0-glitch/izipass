"use client"

import { useEffect, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

const KEY = "izi:navigated"
const EVENT = "izi:navigated"

/** True once this tab has moved between izipass pages (so there is an izipass page to go back to). */
function navigated() {
  try {
    if (sessionStorage.getItem(KEY)) return true
    return !!document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1
  } catch {
    return false
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}

let firstPath: string | null = null

/** Mounted once in the layout: notes the first move to another page in this tab. */
export function NavigationTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (firstPath === null) firstPath = pathname
    else if (pathname !== firstPath) {
      try {
        sessionStorage.setItem(KEY, "1")
      } catch {}
      window.dispatchEvent(new Event(EVENT))
    }
  }, [pathname])
  return null
}

/** "Back" to the page this one was opened from; hidden when it was opened from outside the app. */
export function BackButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter()
  const show = useSyncExternalStore(subscribe, navigated, () => false)
  if (!show) return null
  return (
    <div className={className}>
      <Button variant="link" size="sm" className="h-auto w-fit px-0 text-muted-foreground has-[>svg]:px-0" onClick={() => router.back()}>
        <ChevronLeft />
        {label}
      </Button>
    </div>
  )
}
