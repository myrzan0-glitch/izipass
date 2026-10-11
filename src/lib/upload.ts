import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/images"

/** Reads one image from a multipart upload, or an error code for the client. */
export async function readImageUpload(request: Request) {
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) return { error: "fileType" as const, status: 400 }
  if (file.size > IMAGE_MAX_BYTES) return { error: "fileTooLarge" as const, status: 413 }
  return { file: { contentType: file.type, data: Buffer.from(await file.arrayBuffer()) } }
}
