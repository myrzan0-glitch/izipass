"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

const MAX_SIDE = 1600

/** Shrinks a screenshot to a JPEG ≤ 1600px before upload; falls back to the original file. */
async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/png" && file.size < 300_000) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

type Phase = { name: "idle" } | { name: "uploading" } | { name: "reading"; percent: number } | { name: "checking" }

type Props = {
  registrationId: string
  /** Button text and style; defaults to the main "Upload receipt" call to action. */
  label?: string
  variant?: "default" | "outline"
  /** The organizer's auto-check add-on is on: read the receipt in the browser and send the text. */
  ocr: boolean
  /** Just a small button, without the hint (e.g. "Replace" next to a sent receipt). */
  compact?: boolean
  dict: Dictionary
}

export function ReceiptUpload({ registrationId, ocr, dict, label: idleLabel, variant = "default", compact = false }: Props) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>({ name: "idle" })
  const [error, setError] = useState<string>()
  const t = dict.status
  const busy = phase.name !== "idle"

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(undefined)
    setPhase({ name: "uploading" })
    try {
      const image = await shrink(file)
      const body = new FormData()
      body.append("file", image, "receipt.jpg")
      const res = await fetch(`/api/registrations/${registrationId}/receipt`, { method: "POST", body })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(dict.errors[(data.error ?? "generic") as keyof Dictionary["errors"]] ?? dict.errors.generic)
        return
      }
      const { receiptId } = (await res.json()) as { receiptId?: string }
      // The receipt is saved; auto-check is best effort and never blocks the attendee.
      if (ocr && receiptId) {
        setPhase({ name: "reading", percent: 0 })
        const { readReceipt } = await import("@/lib/client/ocr")
        const text = await readReceipt(image, (p) => setPhase({ name: "reading", percent: p.stage === "reading" ? 20 + Math.round(p.percent * 0.8) : Math.round(p.percent * 0.2) }))
        if (text) {
          setPhase({ name: "checking" })
          await fetch(`/api/receipts/${receiptId}/text`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          }).catch(() => null)
        }
      }
      router.refresh()
    } catch {
      setError(dict.errors.generic)
    } finally {
      setPhase({ name: "idle" })
      if (input.current) input.current.value = ""
    }
  }

  const label =
    phase.name === "uploading"
      ? t.uploading
      : phase.name === "reading"
        ? fmt(t.reading, { n: phase.percent })
        : phase.name === "checking"
          ? t.checking
          : (idleLabel ?? t.uploadReceipt)

  return (
    <Field data-invalid={!!error} className="relative">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
        disabled={busy}
      />
      <Button type="button" size={compact ? "sm" : "lg"} variant={variant} onClick={() => input.current?.click()} disabled={busy} aria-live="polite">
        <Upload />
        {label}
      </Button>
      {!compact && <FieldDescription>{ocr ? t.uploadHintOcr : t.uploadHint}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
