"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(min-width: 768px)"

function subscribe(callback: () => void) {
  const list = window.matchMedia(QUERY)
  list.addEventListener("change", callback)
  return () => list.removeEventListener("change", callback)
}

/** True on tablets and computers: dialogs there, bottom sheets on phones. */
export function useDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  )
}
