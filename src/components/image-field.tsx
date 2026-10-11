"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Trash2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  /** POST uploads, DELETE removes. */
  endpoint: string
  url: string | null
  shape: "square" | "wide"
  label: string
  hint: string
  /** Initials shown in an empty square (logo). */
  fallback?: string
  dict: Dictionary
}

/**
 * Picks an image, shrinks it in the browser (a square 512px logo or a
 * 1600px-wide cover), uploads it, and refreshes the page.
 */
async function prepare(file: File, shape: Props["shape"]): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  if (shape === "square") {
    const side = Math.min(bitmap.width, bitmap.height)
    canvas.width = canvas.height = Math.min(512, side)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  } else {
    const scale = Math.min(1, 1600 / bitmap.width)
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  }
  // Formats every link preview shows (Telegram, Open Graph): PNG keeps logo transparency, JPEG keeps covers small.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, shape === "square" ? "image/png" : "image/jpeg", 0.85))
  return blob ?? file
}

export function ImageField({ endpoint, url, shape, label, hint, fallback, dict }: Props) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const t = dict.organizer

  const send = async (method: "POST" | "DELETE", file?: File) => {
    setBusy(true)
    setError(undefined)
    try {
      let body: FormData | undefined
      if (file) {
        body = new FormData()
        const blob = await prepare(file, shape).catch(() => file)
        body.append("file", blob, "image")
      }
      const res = await fetch(endpoint, { method, body })
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
      <FieldLabel>{label}</FieldLabel>
      <div className={shape === "square" ? "flex items-center gap-4" : "flex flex-col gap-3"}>
        {shape === "square" ? (
          <Avatar className="size-16 rounded-lg">
            {url && <AvatarImage src={url} alt="" className="object-cover" />}
            <AvatarFallback className="rounded-lg text-lg">{fallback}</AvatarFallback>
          </Avatar>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own resized image
          <img src={url} alt="" className="aspect-video w-full rounded-lg border object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-accent/40"
          >
            <ImagePlus className="size-6" aria-hidden />
            <span className="sr-only">{t.upload}</span>
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && send("POST", e.target.files[0])}
            disabled={busy}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
            <ImagePlus />
            {busy ? dict.status.uploading : url ? t.replace : t.upload}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => send("DELETE")} disabled={busy}>
              <Trash2 />
              {t.remove}
            </Button>
          )}
        </div>
      </div>
      <FieldDescription>{hint}</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
