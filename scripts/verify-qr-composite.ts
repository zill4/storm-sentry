// Offline verification of the QR composite path: synthetic "raw design" →
// compositeQrOntoDesign → decode the QR back out with jsqr → assert URL.
import sharp from "sharp"
import jsQR from "jsqr"

import { compositeQrOntoDesign } from "@/lib/design/composite"

async function main() {
  // Synthetic 3072x2048 "tarp design" with busy art (worst case for QR: noise
  // everywhere, including the top-right corner where the plate lands).
  const svg = `<svg width="3072" height="2048" xmlns="http://www.w3.org/2000/svg">
    <rect width="3072" height="2048" fill="#0B2037"/>
    <circle cx="800" cy="700" r="500" fill="#1FA6E5"/>
    <rect x="1500" y="100" width="1500" height="400" fill="#F47A20"/>
    <rect x="0" y="1300" width="3072" height="748" fill="#000"/>
    <text x="1536" y="820" font-family="Arial" font-size="220" font-weight="bold" fill="#fff" text-anchor="middle">RIVERA ROOFING</text>
  </svg>`
  const raw = await sharp(Buffer.from(svg)).png().toBuffer()

  const url = "https://stormsentry.app/q/test123"
  const { png, width, height } = await compositeQrOntoDesign(raw, url, "modern_star")
  console.log(`composited: ${width}x${height}, ${(png.length / 1024).toFixed(0)}KB`)
  await sharp(png).toFile(process.env.OUT ?? "composited.png")

  // Decode pass 1: full image at print resolution.
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const full = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)

  // Decode pass 2: simulate a phone scan of the printed corner (downscaled).
  const small = await sharp(png).resize({ width: 900 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const phone = jsQR(
    new Uint8ClampedArray(small.data.buffer, small.data.byteOffset, small.data.length),
    small.info.width,
    small.info.height,
  )

  console.log("full-res decode:", full?.data ?? "FAILED")
  console.log("phone-sim decode:", phone?.data ?? "FAILED")
  if (full?.data !== url || phone?.data !== url) {
    console.error("QR VERIFICATION FAILED")
    process.exit(1)
  }
  console.log("QR verification PASSED")
}

main()
