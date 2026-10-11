"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Copies a value (card number, amount, code) and confirms with a toast. */
export function CopyButton({ value, label, copied }: { value: string; label: string; copied: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`${label}: ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast.success(copied)
        } catch {
          // Clipboard blocked (some in-app browsers): the value stays selectable on the page.
        }
      }}
    >
      <Copy />
      {label}
    </Button>
  )
}
