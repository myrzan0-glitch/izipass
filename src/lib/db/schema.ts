import { sql } from "drizzle-orm"
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

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
    /** Receipt auto-check is a paid add-on (per participant). */
    autoCheck: boolean("auto_check").notNull().default(false),
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

export const PLAN_LIMITS = {
  free: { eventsPerMonth: 2, participantsPerEvent: 20, priceUzs: 0 },
  pro: { eventsPerMonth: 10, participantsPerEvent: 100, priceUzs: 299_000 },
} as const

/** Per participant, when the organizer enables auto-check. */
export const AUTO_CHECK_PRICE_UZS = 500

export type User = typeof users.$inferSelect
export type Organizer = typeof organizers.$inferSelect
