import QRCode from "qrcode"

// QR rendering for tarp designs. Error correction H (30%) because the code is
// destined for large-format print viewed at odd angles — scannability beats
// data density (our payload is a short /q/{slug} URL anyway).

const QR_OPTS = {
  errorCorrectionLevel: "H",
  margin: 2, // quiet zone (modules); the composite step adds its own padding
} as const

/** PNG buffer at the requested pixel width (used for compositing onto designs). */
export function qrPng(url: string, sizePx = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...QR_OPTS, type: "png", width: sizePx })
}

/** Vector SVG (goes in the print bundle so the vendor can scale losslessly). */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...QR_OPTS, type: "svg" })
}
