"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Puts the test accounts and the Test Club back to the start. */
export function TestStandReset({ label, done }: { label: string; done: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/test-stand", { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success(done)
      router.refresh()
    } catch {
      toast.error("Error")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-inherit underline" disabled={busy} onClick={reset}>
      <RotateCcw className="size-3" />
      {label}
    </Button>
  )
}
