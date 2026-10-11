"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Send } from "lucide-react"
import { toast } from "sonner"

import { TelegramLogin } from "@/components/telegram-login"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"

/** For people who signed in by email: link Telegram to hear about their registration there. */
export function ConnectTelegram({ lang, bot, dict }: { lang: Locale; bot: string; dict: Dictionary }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const g = dict.guest
  if (!bot) return null

  const link = async (user: Record<string, string | number>) => {
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, lang, link: true }),
    })
    if (res.status === 409) return toast.error(dict.settings.errors.telegramTaken)
    if (!res.ok) return toast.error(dict.login.errors.telegram)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4" />
          {g.connectTitle}
        </CardTitle>
        <CardDescription>{g.connectBody}</CardDescription>
      </CardHeader>
      <CardContent>
        {open ? (
          <TelegramLogin bot={bot} onAuth={link} />
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
            <Send />
            {g.connect}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
