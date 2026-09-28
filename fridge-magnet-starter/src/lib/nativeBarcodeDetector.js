// Chrome on Android ships a barcode reader built into the browser itself —
// faster and lighter on the battery than decoding frames in JavaScript, so
// it's used whenever it's there. Safari has no such thing, which is what
// the ZXing fallback in useBarcodeScanner is for.
const GROCERY_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export function isNativeBarcodeDetectorSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

export async function createNativeDetector() {
  const supported = window.BarcodeDetector.getSupportedFormats
    ? await window.BarcodeDetector.getSupportedFormats()
    : null
  const formats = supported ? GROCERY_FORMATS.filter((format) => supported.includes(format)) : GROCERY_FORMATS
  return new window.BarcodeDetector({ formats: formats.length ? formats : GROCERY_FORMATS })
}
