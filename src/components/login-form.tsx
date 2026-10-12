"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { TelegramLogin } from "@/components/telegram-login"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

type Props = {
  lang: Locale
  next: string
  bot: string
  initialError?: string
  dict: Dictionary["login"]
  /** On the test stand no email is sent: the sign-in link is shown instead. */
  testStand?: Dictionary["testStand"]
}

export function LoginForm({ lang, next, bot, initialError, dict, testStand }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState<string | null>(null)
  const [testLink, setTestLink] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // From the URL (e.g. an expired email link): shown above the form, not on the field.
  const notice = initialError === "expired" ? dict.errors.expired : initialError ? dict.errors.generic : undefined

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(dict.errors.email)
    setBusy(true)
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang, next }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { link?: string; next?: string }
      // Test stand: a test account is signed in right away.
      if (data.next) {
        router.push(data.next)
        router.refresh()
        return
      }
      setTestLink(data.link)
      setSent(email)
    } catch {
      setError(dict.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  const telegramAuth = async (user: Record<string, string | number>) => {
    try {
      const res = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, lang, next }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { next: string }
      router.push(data.next)
      router.refresh()
    } catch {
      toast.error(dict.errors.telegram)
    }
  }

  if (sent && testStand && testLink) {
    return (
      <Alert>
        <AlertTitle>{testStand.linkTitle}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          {sent}
          <Button asChild size="sm">
            <a href={testLink}>{testStand.openLink}</a>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (sent) {
    return (
      <Alert>
        <AlertTitle>{dict.sentTitle}</AlertTitle>
        <AlertDescription>{fmt(dict.sentBody, { email: sent })}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <Alert variant="destructive">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {bot ? (
        <TelegramLogin bot={bot} onAuth={telegramAuth} />
      ) : (
        <p className="text-center text-sm text-muted-foreground">{dict.telegramUnavailable}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        {dict.or}
        <Separator className="flex-1" />
      </div>

      <form onSubmit={sendLink} noValidate className="flex flex-col gap-4">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="email">{dict.emailLabel}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={dict.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            required
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? dict.sending : dict.sendLink}
        </Button>
      </form>
    </div>
  )
}
