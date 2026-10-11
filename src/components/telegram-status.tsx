import { Send } from "lucide-react"

import { reconnectTelegramAction } from "@/app/[lang]/dashboard/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { User } from "@/lib/db/schema"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/dictionaries/en"
import { fmt } from "@/lib/i18n/format"
import { SITE_URL, TELEGRAM_BOT } from "@/lib/site"
import { telegramApiFromEnv } from "@/lib/telegram/api"
import { webhookStatus, type WebhookStatus } from "@/lib/telegram/webhook"

/** Organizer page: is the bot connected, and if not, why. */
export async function TelegramStatus({ lang, user, dict }: { lang: Locale; user: User; dict: Dictionary }) {
  const t = dict.telegram
  const api = telegramApiFromEnv()
  let status: WebhookStatus | null = null
  let unreachable = false
  if (api) {
    try {
      status = await webhookStatus(api, SITE_URL)
    } catch {
      unreachable = true
    }
  }
  const ok = !!status?.connected && !status.lastError

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.hint}</CardDescription>
        {api && status && (
          <CardAction>
            <Badge variant={ok ? "secondary" : "destructive"}>{ok ? t.connected : t.notConnected}</Badge>
          </CardAction>
        )}
      </CardHeader>
      {(!api || unreachable || status?.lastError || (status && status.pending > 0) || !user.telegramId) && (
        <CardContent className="flex flex-col gap-3">
          {!api && (
            <Alert>
              <AlertDescription>{t.notConfigured}</AlertDescription>
            </Alert>
          )}
          {unreachable && (
            <Alert variant="destructive">
              <AlertDescription>{t.unreachable}</AlertDescription>
            </Alert>
          )}
          {status?.lastError && (
            <Alert variant="destructive">
              <AlertDescription>{fmt(t.lastError, { error: status.lastError })}</AlertDescription>
            </Alert>
          )}
          {status && status.pending > 0 && <p className="text-sm text-muted-foreground">{fmt(t.pending, { n: status.pending })}</p>}
          {api && !user.telegramId && (
            <Alert>
              <AlertDescription>{t.notLinked}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
      {api && (
        <CardFooter className="flex flex-wrap gap-2">
          <form action={reconnectTelegramAction}>
            <input type="hidden" name="lang" value={lang} />
            <Button type="submit" variant={ok ? "outline" : "default"} size="sm">
              {t.reconnect}
            </Button>
          </form>
          {TELEGRAM_BOT && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noopener">
                <Send />
                {t.openBot}
              </a>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
