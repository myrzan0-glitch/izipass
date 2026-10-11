"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

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

export function ReceiptUpload({ registrationId, dict }: { registrationId: string; dict: Dictionary }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const t = dict.status

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(undefined)
    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", await shrink(file), "receipt.jpg")
      const res = await fetch(`/api/registrations/${registrationId}/receipt`, { method: "POST", body })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(dict.errors[(data.error ?? "generic") as keyof Dictionary["errors"]] ?? dict.errors.generic)
        return
      }
      router.refresh()
    } catch {
      setError(dict.errors.generic)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <Field data-invalid={!!error}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => upload(e.target.files?.[0])}
        disabled={busy}
      />
      <Button type="button" size="lg" onClick={() => input.current?.click()} disabled={busy}>
        <Upload />
        {busy ? t.uploading : t.uploadReceipt}
      </Button>
      <FieldDescription>{t.uploadHint}</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
