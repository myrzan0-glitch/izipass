"use client"

import { useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"

import { ImageField } from "@/components/image-field"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { prepareImage } from "@/lib/client/image"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

type Props = {
  /** An existing event uploads right away; a new one sends the cover with the form. */
  endpoint: string | null
  url: string | null
  dict: Dictionary
}

/** The square cover on the left of Create event. */
export function CoverPicker({ endpoint, url, dict }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const t = dict.create

  if (endpoint) return <ImageField endpoint={endpoint} url={url} shape="cover" label={t.cover} hint={t.coverHint} dict={dict} />

  // Swap the picked file for the shrunk one, so the form sends a small JPEG.
  const pick = async (file: File) => {
    setBusy(true)
    try {
      const blob = await prepareImage(file, "cover").catch(() => file)
      const shrunk = new File([blob], "cover.jpg", { type: blob.type || file.type })
      const transfer = new DataTransfer()
      transfer.items.add(shrunk)
      if (input.current) input.current.files = transfer.files
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(shrunk)
      })
    } finally {
      setBusy(false)
    }
  }
  const clear = () => {
    if (input.current) input.current.value = ""
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
  }

  return (
    <Field className="relative">
      <FieldLabel className="sr-only">{t.cover}</FieldLabel>
      <input
        ref={input}
        type="file"
        name="cover"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        disabled={busy}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview
        <img src={preview} alt="" className="aspect-square w-full rounded-xl border object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/50 text-sm text-muted-foreground hover:bg-accent/40"
        >
          <ImagePlus className="size-6" aria-hidden />
          {t.addCover}
        </button>
      )}
      {preview && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
            <ImagePlus />
            {dict.organizer.replace}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Trash2 />
            {dict.organizer.remove}
          </Button>
        </div>
      )}
      <FieldDescription>{t.coverHint}</FieldDescription>
    </Field>
  )
}
