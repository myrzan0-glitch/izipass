import "server-only"

import { Resend } from "resend"

import { isTestStand } from "@/lib/test-stand"

/**
 * Without RESEND_API_KEY the email is logged instead of sent: always in dev,
 * and in production only with EMAIL_LOG_ONLY=1 (local `next start`). The test stand never sends.
 */
export async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  const key = isTestStand() ? undefined : process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? "izipass <login@izipass.myrzan.com>"
  if (!key) {
    if (process.env.NODE_ENV === "production" && !process.env.EMAIL_LOG_ONLY && !isTestStand()) throw new Error("RESEND_API_KEY is not set")
    console.log(`[email] to ${input.to}: ${input.subject}\n${input.text}`)
    return
  }
  const { error } = await new Resend(key).emails.send({ from, ...input })
  if (error) throw new Error(`email failed: ${error.message}`)
}
