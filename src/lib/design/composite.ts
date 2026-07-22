import sharp from "sharp"

import { qrPng } from "@/lib/qr/image"
import { qrZoneFraction } from "./prompt"

// Deterministic QR compositing. The model is told to reserve a white square
// top-right in the brand band (matching the production samples); we paste a
// real QR there regardless, on its own white plate, so scannability never
// depends on the model having complied pixel-perfectly.

const EDGE_MARGIN_FRACTION = 0.025

export async function compositeQrOntoDesign(
  rawPng: Buffer,
  qrTargetUrl: string,
  styleKey: string | null,
): Promise<{ png: Buffer; width: number; height: number }> {
  const base = sharp(rawPng)
  const meta = await base.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) throw new Error("could not read generated image dimensions")

  const plateSize = Math.round(width * qrZoneFraction(styleKey))
  const pad = Math.round(plateSize * 0.09)
  const qrSize = plateSize - pad * 2
  const margin = Math.round(width * EDGE_MARGIN_FRACTION)
  const left = width - margin - plateSize
  const top = margin // top-right of the brand band
  const radius = Math.round(plateSize * 0.08)

  // White rounded plate (quiet zone lives inside the QR render margin too).
  const plate = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}" xmlns="http://www.w3.org/2000/svg"><rect width="${plateSize}" height="${plateSize}" rx="${radius}" fill="#FFFFFF"/></svg>`,
  )
  const qr = await qrPng(qrTargetUrl, qrSize)

  const png = await base
    .composite([
      { input: plate, left, top },
      { input: qr, left: left + pad, top: top + pad },
    ])
    .png()
    .toBuffer()

  return { png, width, height }
}
