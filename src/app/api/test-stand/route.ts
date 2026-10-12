import { sql } from "drizzle-orm"
import { z } from "zod"

import { createSessionToken, sessionCookie } from "@/lib/auth/session"
import { safeNext } from "@/lib/auth/tokens"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"
import { TEST_ACCOUNTS, isTestStand, seedTestStand } from "@/lib/test-stand"

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("signin"),
    account: z.enum(TEST_ACCOUNTS.map((a) => a.key)),
    lang: z.string().optional(),
    next: z.string().optional(),
  }),
  z.object({ action: z.literal("reset") }),
])

/** Test stand only: one-click sign-in as a test account, and "reset test data". */
export async function POST(request: Request) {
  if (!isTestStand()) return new Response(null, { status: 404 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 })

  const body = parsed.data
  if (body.action === "reset") {
    await seedTestStand(db(), { reset: true })
    return Response.json({ ok: true })
  }

  await seedTestStand(db())
  const { email } = TEST_ACCOUNTS.find((a) => a.key === body.account)!
  const [user] = await db().select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
  if (!user) return Response.json({ error: "not_seeded" }, { status: 500 })
  await db().update(users).set({ lastLoginAt: new Date() }).where(sql`${users.id} = ${user.id}`)

  const lang = body.lang && isLocale(body.lang) ? body.lang : DEFAULT_LOCALE
  const response = Response.json({ next: safeNext(body.next, `/${lang}/events`) })
  const c = sessionCookie(await createSessionToken({ userId: user.id }))
  response.headers.append(
    "Set-Cookie",
    [`${c.name}=${c.value}`, `Path=${c.path}`, `Max-Age=${c.maxAge}`, "SameSite=Lax", "HttpOnly", ...(c.secure ? ["Secure"] : [])].join("; ")
  )
  return response
}
