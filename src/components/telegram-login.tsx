"use client"

import { useEffect, useRef } from "react"

type TelegramUser = Record<string, string | number>

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void
  }
}

/**
 * Renders the official Telegram Login Widget (it injects an iframe button).
 * The bot's domain must be set with @BotFather → /setdomain.
 */
export function TelegramLogin({ bot, onAuth }: { bot: string; onAuth: (user: TelegramUser) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const latest = useRef(onAuth)

  useEffect(() => {
    latest.current = onAuth
  }, [onAuth])

  useEffect(() => {
    const el = container.current
    if (!el) return
    window.onTelegramAuth = (user) => latest.current(user)
    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.dataset.telegramLogin = bot
    script.dataset.size = "large"
    script.dataset.radius = "8"
    script.dataset.userpic = "false"
    script.dataset.requestAccess = "write"
    script.dataset.onauth = "onTelegramAuth(user)"
    el.replaceChildren(script)
    return () => {
      el.replaceChildren()
      delete window.onTelegramAuth
    }
  }, [bot])

  return <div ref={container} className="flex min-h-10 justify-center" />
}
