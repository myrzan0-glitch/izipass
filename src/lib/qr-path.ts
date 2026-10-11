import { create } from "qrcode"

export type QrPath = { size: number; d: string }

/** A QR code as one SVG path (one unit per module), so it can be drawn in SVG or on a canvas. */
export function qrPath(value: string): QrPath {
  const { size, data } = create(value, { errorCorrectionLevel: "L" }).modules
  let d = ""
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`
    }
  }
  return { size, d }
}
