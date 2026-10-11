import { z } from "zod"

import { RESERVED_SLUGS, SLUG_PATTERN } from "@/lib/slug"

/** Error messages are dictionary keys under `errors`, resolved in the UI. */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_PATTERN, "slug")
  .refine((s) => !RESERVED_SLUGS.has(s), "slugReserved")

const link = z.string().trim().url("url").max(200)

export const organizerSchema = z.object({
  slug,
  name: z.string().trim().min(2, "required").max(60, "tooLong"),
  description: z.string().trim().max(1000, "tooLong").default(""),
  links: z.array(link).max(5).default([]),
  // Receipt auto-check (paid add-on) and what a matching receipt should show.
  autoCheck: z.boolean().default(false),
  autoApprove: z.boolean().default(false),
  payoutCardLast4: z
    .string()
    .trim()
    .regex(/^(\d{4})?$/, "last4")
    .transform((s) => s || null)
    .default(""),
  payoutName: z
    .string()
    .trim()
    .max(60, "tooLong")
    .transform((s) => s || null)
    .default(""),
})
export type OrganizerInput = z.infer<typeof organizerSchema>

export const HOLD_MINUTES = [15, 30, 60, 120] as const

export const eventSchema = z
  .object({
    slug,
    title: z.string().trim().min(2, "required").max(80, "tooLong"),
    description: z.string().trim().max(4000, "tooLong").default(""),
    startsAt: z.date(),
    endsAt: z.date().nullable().default(null),
    venue: z.string().trim().max(160, "tooLong").default(""),
    venueUrl: z.union([link, z.literal("")]).default(""),
    capacity: z.number().int().min(1, "min1").max(10_000, "tooLarge"),
    priceUzs: z.number().int().min(0, "min0").max(100_000_000, "tooLarge"),
    paymentInstructions: z.string().trim().max(1000, "tooLong").default(""),
    holdMinutes: z.number().int().refine((n) => (HOLD_MINUTES as readonly number[]).includes(n), "invalid"),
  })
  .refine((e) => !e.endsAt || e.endsAt > e.startsAt, { message: "endsBeforeStart", path: ["endsAt"] })
  .refine((e) => e.priceUzs === 0 || e.paymentInstructions.length > 0, { message: "paymentRequired", path: ["paymentInstructions"] })
export type EventInput = z.infer<typeof eventSchema>

/** Flattens zod issues to one message key per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    out[key] ??= issue.message
  }
  return out
}
