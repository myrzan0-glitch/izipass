// Serves the barcode reader's .wasm and the OCR engine (worker, core, language
// data) from our own origin instead of a CDN. Runs on `npm install`.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)

function copy(from, toDir, name = from.split("/").pop()) {
  mkdirSync(toDir, { recursive: true })
  copyFileSync(from, join(toDir, name))
}

copy(require.resolve("zxing-wasm/reader/zxing_reader.wasm"), "public/zxing")

// tesseract.js: worker + core (LSTM only; the worker picks the SIMD variant the browser supports).
copy(require.resolve("tesseract.js/dist/worker.min.js"), "public/tesseract")
const core = dirname(require.resolve("tesseract.js-core/package.json"))
// The .wasm.js builds embed the wasm, which is what the worker loads.
for (const variant of ["", "simd-", "relaxedsimd-"]) copy(join(core, `tesseract-core-${variant}lstm.wasm.js`), "public/tesseract/core")
// Language data (Latin + Cyrillic receipts), gzipped, cached by the browser after first use.
for (const lang of ["eng", "rus"]) {
  const pkg = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`))
  copy(join(pkg, "4.0.0_best_int", `${lang}.traineddata.gz`), "public/tesseract/lang")
}
