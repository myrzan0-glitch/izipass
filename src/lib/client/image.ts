/**
 * Shrinks an image in the browser before upload: a 512px square PNG logo
 * (keeps transparency), a 1080px square JPEG event cover, or a 1600×600
 * JPEG organization banner (small, and every link preview shows JPEG).
 */
export async function prepareImage(file: File, kind: "logo" | "cover" | "banner"): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  if (kind === "banner") {
    // An organization's banner: 8:3, at most 1600px wide, cropped from the middle.
    const height = Math.min(bitmap.height, (bitmap.width * 3) / 8)
    const width = (height * 8) / 3
    canvas.width = Math.min(1600, Math.round(width))
    canvas.height = Math.round((canvas.width * 3) / 8)
    ctx.drawImage(bitmap, (bitmap.width - width) / 2, (bitmap.height - height) / 2, width, height, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
    return blob ?? file
  }
  const side = Math.min(bitmap.width, bitmap.height)
  canvas.width = canvas.height = Math.min(kind === "logo" ? 512 : 1080, side)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, kind === "logo" ? "image/png" : "image/jpeg", 0.85))
  return blob ?? file
}
