// Serves the barcode reader's .wasm from our own origin instead of a CDN.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
mkdirSync("public/zxing", { recursive: true })
copyFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm"), "public/zxing/zxing_reader.wasm")
