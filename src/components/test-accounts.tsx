"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { initials } from "@/lib/initials"

type Account = { key: "organizer" | "alina" | "bobur" | "dilnoza"; name: string }

/** Test stand only: sign in as a ready-made account, or put the test data back to the start. */
export function TestAccounts({ lang, next, accounts, dict }: { lang: Locale; next: string; accounts: Account[]; dict: Dictionary["testStand"] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const call = async (body: object) => {
    const res = await fetch("/api/test-stand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error()
    return (await res.json()) as { next?: string }
  }
  const signIn = async (account: Account["key"]) => {
    setBusy(account)
    try {
      const data = await call({ action: "signin", account, lang, next })
      router.push(data.next ?? `/${lang}/events`)
      router.refresh()
    } catch {
      toast.error("Error")
      setBusy(null)
    }
  }
  const reset = async () => {
    setBusy("reset")
    try {
      await call({ action: "reset" })
      toast.success(dict.resetDone)
    } catch {
      toast.error("Error")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="w-full max-w-sm border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4" />
          {dict.accountsTitle}
        </CardTitle>
        <CardDescription>{dict.accountsBody}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {accounts.map((a) => (
          <Button
            key={a.key}
            variant="outline"
            className="h-auto justify-start gap-3 py-2 text-left"
            disabled={busy !== null}
            onClick={() => signIn(a.key)}
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials(a.name)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{a.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{dict[a.key]}</span>
            </span>
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="mt-1 self-start text-muted-foreground" disabled={busy !== null} onClick={reset}>
          <RotateCcw />
          {dict.reset}
        </Button>
      </CardContent>
    </Card>
  )
}
