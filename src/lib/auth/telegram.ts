import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

/**
 * Verifies data from the Telegram Login Widget:
 * hash = HMAC_SHA256(key = SHA256(bot_token), data_check_string).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export const telegramAuthSchema = z.object({
  id: z.string().regex(/^\d+$/),
  first_name: z.string().default(""),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.string().regex(/^\d+$/),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
})

export type TelegramAuth = z.infer<typeof telegramAuthSchema>

const MAX_AGE_SECONDS = 10 * 60

export function verifyTelegramAuth(
  params: Record<string, string>,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): TelegramAuth | null {
  const parsed = telegramAuthSchema.safeParse(params)
  if (!parsed.success) return null
  const { hash, ...fields } = parsed.data

  const checkString = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")
  const key = createHash("sha256").update(botToken).digest()
  const expected = createHmac("sha256", key).update(checkString).digest("hex")
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(hash, "hex"))) return null
  if (now - Number(fields.auth_date) > MAX_AGE_SECONDS) return null
  return parsed.data
}

export function telegramDisplayName(auth: TelegramAuth) {
  return [auth.first_name, auth.last_name].filter(Boolean).join(" ").trim() || auth.username || `tg${auth.id}`
}
