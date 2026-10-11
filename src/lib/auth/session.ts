import "server-only"

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

export const SESSION_COOKIE = "session"
const SESSION_DAYS = 30

function secret() {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)")
  return new TextEncoder().encode(value)
}

export type Session = { userId: string }

export async function createSessionToken(session: Session) {
  return new SignJWT({ sub: session.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] })
    return payload.sub ? { userId: payload.sub } : null
  } catch {
    return null
  }
}

export async function getSession() {
  const store = await cookies()
  return readSessionToken(store.get(SESSION_COOKIE)?.value)
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  }
}

export function clearedSessionCookie() {
  return { ...sessionCookie(""), maxAge: 0 }
}
