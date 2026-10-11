type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> }

let detector: Promise<Detector> | undefined

/** Lazily loads the ZXing-based QR reader; the .wasm is served from /zxing. */
export function getDetector(): Promise<Detector> {
  detector ??= import("barcode-detector/ponyfill").then(({ BarcodeDetector, prepareZXingModule }) => {
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path),
      },
    })
    return new BarcodeDetector({ formats: ["qr_code"] })
  })
  return detector
}

export async function detectQr(source: ImageBitmapSource): Promise<string | null> {
  const results = await (await getDetector()).detect(source)
  return results.find((r) => r.rawValue)?.rawValue ?? null
}
