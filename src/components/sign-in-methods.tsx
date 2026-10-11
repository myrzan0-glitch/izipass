"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Send } from "lucide-react"
import { toast } from "sonner"

import { TelegramLogin } from "@/components/telegram-login"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"

type Props = {
  lang: Locale
  telegram: string | null
  email: string | null
  /** The bot's username for the login widget; empty when Telegram isn't set up. */
  bot: string
  dict: Dictionary
}

/** Settings → Sign-in and messages: the Telegram account and the email on this account. */
export function SignInMethods({ lang, telegram, email, bot, dict }: Props) {
  const t = dict.settings
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [address, setAddress] = useState("")
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const linkTelegram = async (user: Record<string, string | number>) => {
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, lang, link: true, next: `/${lang}/settings` }),
    })
    if (res.status === 409) return toast.error(t.errors.telegramTaken)
    if (!res.ok) return toast.error(dict.login.errors.telegram)
    setConnecting(false)
    router.refresh()
  }

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError(dict.login.errors.email)
    setBusy(true)
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, lang, link: true, next: `/${lang}/settings?saved=1` }),
      })
      if (!res.ok) throw new Error()
      setSent(address)
      setEditing(false)
    } catch {
      setError(dict.login.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      <Separator />
      <div className="flex flex-wrap items-center gap-3 py-4">
        <Send className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.telegram}</p>
          <p className="truncate text-sm text-muted-foreground">{telegram ?? t.notAdded}</p>
        </div>
        {telegram ? (
          <Badge variant="secondary">{t.connected}</Badge>
        ) : bot && !connecting ? (
          <Button variant="outline" size="sm" onClick={() => setConnecting(true)}>
            {t.connectTelegram}
          </Button>
        ) : null}
        {connecting && (
          <div className="w-full">
            <TelegramLogin bot={bot} onAuth={linkTelegram} />
          </div>
        )}
      </div>
      <Separator />
      <div className="flex flex-wrap items-center gap-3 py-4">
        <Mail className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.email}</p>
          <p className="truncate text-sm text-muted-foreground">{sent ? fmt(t.emailSent, { email: sent }) : (email ?? t.notAdded)}</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {email ? t.changeEmail : t.addEmail}
          </Button>
        )}
        {editing && (
          <form onSubmit={sendLink} noValidate className="flex w-full flex-wrap items-start gap-2">
            <Field data-invalid={!!error} className="min-w-0 flex-1">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={dict.login.emailPlaceholder}
                aria-label={t.email}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? dict.login.sending : t.sendConfirm}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
