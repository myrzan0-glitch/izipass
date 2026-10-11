/**
 * Reads a receipt screenshot in the browser with tesseract.js (free, no API
 * key): the engine, wasm core and language data are served from our own
 * origin (`public/tesseract`, copied on install) and cached by the browser.
 */
const ASSETS = "/tesseract"
const TIMEOUT_MS = 90_000

export type OcrProgress = { stage: "loading" | "reading"; percent: number }

/** Returns the recognized text, or null when OCR failed or timed out. */
export async function readReceipt(image: Blob, onProgress: (p: OcrProgress) => void): Promise<string | null> {
  const origin = window.location.origin
  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null
  const timer = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))
  try {
    const { createWorker, OEM } = await import("tesseract.js")
    const run = (async () => {
      worker = await createWorker("eng+rus", OEM.LSTM_ONLY, {
        workerPath: `${origin}${ASSETS}/worker.min.js`,
        corePath: `${origin}${ASSETS}/core`,
        langPath: `${origin}${ASSETS}/lang`,
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") onProgress({ stage: "reading", percent: Math.round(m.progress * 100) })
          else onProgress({ stage: "loading", percent: Math.round(m.progress * 100) })
        },
      })
      const { data } = await worker.recognize(image)
      return data.text
    })()
    const text = await Promise.race([run, timer])
    return text && text.trim() ? text : null
  } catch {
    return null
  } finally {
    // Freed in the background; a terminated worker drops the race's pending promise harmlessly.
    void (worker as { terminate(): Promise<unknown> } | null)?.terminate()
  }
}
