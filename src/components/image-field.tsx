"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Trash2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { prepareImage } from "@/lib/client/image"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  /** POST uploads, DELETE removes. */
  endpoint: string
  url: string | null
  shape: "square" | "cover"
  label: string
  hint: string
  /** Initials shown in an empty square (logo). */
  fallback?: string
  dict: Dictionary
}

/** Picks an image, shrinks it in the browser, uploads it, and refreshes the page. */
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
        const blob = await prepareImage(file, shape === "square" ? "logo" : "cover").catch(() => file)
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
          <img src={url} alt="" className="aspect-square w-full rounded-xl border object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed bg-muted/50 text-muted-foreground hover:bg-accent/40"
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
