import { sql } from "drizzle-orm"
import { boolean, customType, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

import type { Checks, Provider, Verdict } from "@/lib/receipt-check"

const id = () => uuid("id").primaryKey().defaultRandom()
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull().default(""),
    email: text("email"),
    telegramId: text("telegram_id"),
    telegramUsername: text("telegram_username"),
    locale: text("locale").notNull().default("uz"),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(sql`lower(${t.email})`),
    uniqueIndex("users_telegram_id_idx").on(t.telegramId),
  ],
)

/** One-time email sign-in links. Only the token hash is stored. */
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: id(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    /** Where to send the user after signing in (same-site path only). */
    next: text("next"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("login_tokens_hash_idx").on(t.tokenHash), index("login_tokens_email_idx").on(t.email)],
)

export const planEnum = pgEnum("plan", ["free", "pro"])
export const memberRoleEnum = pgEnum("member_role", ["owner", "staff"])

export const organizers = pgTable(
  "organizers",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    logoUrl: text("logo_url"),
    links: text("links").array().notNull().default(sql`'{}'::text[]`),
    plan: planEnum("plan").notNull().default("free"),
    planUntil: timestamp("plan_until", { withTimezone: true }),
    /** Receipt auto-check is a paid add-on (per checked participant). */
    autoCheck: boolean("auto_check").notNull().default(false),
    /** Confirm the spot without the organizer when every check passes. */
    autoApprove: boolean("auto_approve").notNull().default(false),
    /** Used by auto-check to match the receipt's recipient. */
    payoutCardLast4: text("payout_card_last4"),
    payoutName: text("payout_name"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("organizers_slug_idx").on(t.slug)],
)

export const organizerMembers = pgTable(
  "organizer_members",
  {
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("staff"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("organizer_members_pk").on(t.organizerId, t.userId), index("organizer_members_user_idx").on(t.userId)],
)

export const eventStatusEnum = pgEnum("event_status", ["draft", "published", "cancelled"])

export const events = pgTable(
  "events",
  {
    id: id(),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    coverUrl: text("cover_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    venue: text("venue").notNull().default(""),
    venueUrl: text("venue_url"),
    capacity: integer("capacity").notNull(),
    /** 0 = free event. */
    priceUzs: integer("price_uzs").notNull().default(0),
    /** Shown to attendees after registering: Click/Payme link, card number. */
    paymentInstructions: text("payment_instructions").notNull().default(""),
    /** How long a spot is held while the attendee pays. */
    holdMinutes: integer("hold_minutes").notNull().default(30),
    status: eventStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("events_organizer_slug_idx").on(t.organizerId, t.slug), index("events_starts_idx").on(t.startsAt)],
)

export const registrationStatusEnum = pgEnum("registration_status", [
  "held",
  "proof_sent",
  "confirmed",
  "rejected",
  "expired",
  "cancelled",
  "waitlist",
])

/**
 * One person's place at an event.
 * held → proof_sent → confirmed | rejected; held → expired; waitlist → held when a spot frees.
 */
export const registrations = pgTable(
  "registrations",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    note: text("note").notNull().default(""),
    status: registrationStatusEnum("status").notNull().default("held"),
    /** Shown to the attendee and expected in the transfer comment, e.g. ESC-4821. */
    referenceCode: text("reference_code").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    /** Why the organizer rejected it (shown to the attendee). */
    rejectReason: text("reject_reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: uuid("checked_in_by").references(() => users.id, { onDelete: "set null" }),
    /**
     * The last status the attendee knows about: set when they act themselves,
     * and when a Telegram message tells them. A difference means "tell them".
     */
    notifiedStatus: registrationStatusEnum("notified_status"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("registrations_event_user_idx").on(t.eventId, t.userId),
    uniqueIndex("registrations_event_code_idx").on(t.eventId, t.referenceCode),
    index("registrations_user_idx").on(t.userId),
    index("registrations_hold_idx").on(t.holdExpiresAt),
  ],
)

// postgres-js returns Buffer, PGlite returns Uint8Array: normalize to Buffer.
const bytea = customType<{ data: Buffer; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
})

/** Receipt screenshots: small JPEGs, kept in Postgres and deleted 30 days after the event. */
export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    data: bytea("data").notNull(),
    createdAt: createdAt(),
    /** Hex SHA-256 of the image: the same screenshot sent twice is a duplicate. */
    sha256: text("sha256").notNull().default(""),
    // Auto-check (filled when the attendee's browser sends the OCR text).
    ocrText: text("ocr_text"),
    provider: text("provider").$type<Provider>(),
    amountUzs: integer("amount_uzs"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    receiptNo: text("receipt_no"),
    verdict: text("verdict").$type<Verdict>(),
    checks: jsonb("checks").$type<Checks>(),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    /** When the organizers were told about this receipt (claimed once, so they hear about it once). */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [
    index("receipts_registration_idx").on(t.registrationId),
    index("receipts_sha256_idx").on(t.sha256),
    index("receipts_receipt_no_idx").on(t.receiptNo),
  ],
)

export const PLAN_LIMITS = {
  free: { eventsPerMonth: 2, participantsPerEvent: 20, priceUzs: 0 },
  pro: { eventsPerMonth: 10, participantsPerEvent: 100, priceUzs: 299_000 },
} as const

/** Per participant, when the organizer enables auto-check. */
export const AUTO_CHECK_PRICE_UZS = 500

export type User = typeof users.$inferSelect
export type Organizer = typeof organizers.$inferSelect
export type Event = typeof events.$inferSelect
export type Registration = typeof registrations.$inferSelect
export type Receipt = typeof receipts.$inferSelect
export type RegistrationStatus = Registration["status"]
export type EventStatus = Event["status"]
export type Plan = Organizer["plan"]
