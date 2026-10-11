import { db } from "@/lib/db"
import { getImage } from "@/lib/images"

/** Public logos and covers. Each upload gets a new id, so the response never changes. */
export async function GET(_request: Request, { params }: RouteContext<"/api/images/[id]">) {
  const { id } = await params
  const image = await getImage(db(), id)
  if (!image) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
