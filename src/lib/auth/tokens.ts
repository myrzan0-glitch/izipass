import { createHash, randomBytes } from "node:crypto"

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000

/** Raw token goes in the email; only its hash is stored. */
export function createLoginToken() {
  const token = randomBytes(32).toString("base64url")
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback
  return value
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
