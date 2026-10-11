/**
 * Shrinks an image in the browser before upload: a 512px square PNG logo
 * (keeps transparency) or a 1080px square JPEG cover (small, and every link
 * preview shows JPEG).
 */
export async function prepareImage(file: File, kind: "logo" | "cover"): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  const side = Math.min(bitmap.width, bitmap.height)
  canvas.width = canvas.height = Math.min(kind === "logo" ? 512 : 1080, side)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, kind === "logo" ? "image/png" : "image/jpeg", 0.85))
  return blob ?? file
}
