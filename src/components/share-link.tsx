"use client"

import { useSyncExternalStore } from "react"
import { Copy, Send, Share2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

const noop = () => () => {}
/** The phone's own share sheet exists only in the browser, and not everywhere. */
const useCanShare = () => useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false)

/** Event link with Copy, Telegram and (on phones) the system share sheet. */
export function ShareLink({ url, title, dict }: { url: string; title: string; dict: Dictionary["share"] }) {
  const canShare = useCanShare()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(dict.copied)
    } catch {
      // Clipboard blocked (e.g. an in-app browser): select the text so a long-press copies it.
      document.getElementById("share-url")?.focus()
    }
  }
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input id="share-url" readOnly value={url} aria-label={dict.linkLabel} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={copy}>
          <Copy />
          {dict.copy}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={telegram} target="_blank" rel="noopener">
            <Send />
            {dict.telegram}
          </a>
        </Button>
        {canShare && (
          <Button type="button" variant="outline" size="sm" onClick={() => navigator.share({ title, url }).catch(() => {})}>
            <Share2 />
            {dict.more}
          </Button>
        )}
      </div>
    </div>
  )
}
