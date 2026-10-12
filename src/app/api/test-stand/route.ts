import { db } from "@/lib/db"
import { isTestStand, seedTestStand } from "@/lib/test-stand"

/** Test stand only: "Reset test data" in the strip on top of every page. */
export async function POST() {
  if (!isTestStand()) return new Response(null, { status: 404 })
  await seedTestStand(db(), { reset: true })
  return Response.json({ ok: true })
}
