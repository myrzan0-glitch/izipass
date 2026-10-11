import "server-only"

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/lib/db/schema"

export type Db = ReturnType<typeof drizzle<typeof schema>>

let cached: Db | undefined

/** Neon via the Vercel Marketplace sets DATABASE_URL (pooled). */
export function db(): Db {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  cached = drizzle(postgres(url, { prepare: false, max: 5 }), { schema })
  return cached
}

export { schema }
