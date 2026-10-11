// Applies ./drizzle migrations. Skips when DATABASE_URL is absent (local build, CI).
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) {
  console.log("migrate: DATABASE_URL not set, skipping")
  process.exit(0)
}

const client = postgres(url, { max: 1 })
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" })
  console.log("migrate: done")
} finally {
  await client.end()
}
