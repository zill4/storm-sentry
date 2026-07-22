import type { DesignRequestRow } from "./store"
import { designStyle } from "./types"

// Prompt assembly for gpt-image-2, matched to the real Smart Tarp anatomy
// (see sample_layouts.png / assets/design-reference/band-reference.png):
// the artwork is a full-tarp proof where all branding lives in a TOP BAND —
// tagline strip, logo, company name, big phone number, badge chips, QR
// top-right, and a flag-wave transition — while the lower portion stays
// solid black. That black "coverage zone" is deliberate: it's the part of
// the tarp that drapes over debris, so no graphics may live there.

export const TARP_IMAGE_SIZE = process.env.TARP_IMAGE_SIZE ?? "3072x2048" // 3:2 (30ft x 20ft), /16
export const TARP_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2"
export const TARP_IMAGE_QUALITY = (process.env.TARP_IMAGE_QUALITY ?? "high") as
  | "low"
  | "medium"
  | "high"
  | "auto"

/**
 * Reserved QR zone, as fractions of image width. Top-right inside the brand
 * band, like every production sample. Modern Star's whole pitch is the QR, so
 * it gets a larger plate.
 */
export function qrZoneFraction(styleKey: string | null): number {
  return styleKey === "modern_star" ? 0.14 : 0.11
}

const VARIANT_HINTS = [
  "Composition for this variant: classic and symmetrical — logo and company name centered in the band, phone number directly beneath, badges in an even row.",
  "Composition for this variant: logo anchored left with the company name beside it, phone number oversized on the right half of the band.",
  "Composition for this variant: full-width color banding — stacked horizontal bands separating tagline, brand block, and badges, with strong color blocking.",
]

export function variantHint(index: number): string {
  return VARIANT_HINTS[index % VARIANT_HINTS.length]
}

export function buildTarpPrompt(
  request: DesignRequestRow,
  hint?: string,
  withReference = false,
): string {
  const style = designStyle(request.designStyle)
  const services = request.services?.join(" · ") || "ROOFING"
  const badges = request.vendorBadges?.join(", ") || "none"
  const qrPct = Math.round(qrZoneFraction(request.designStyle) * 100)

  const lines = [
    `Design print-ready artwork for a heavy-duty roofing tarp ("Smart Tarp"), landscape 3:2, edge to edge, read from the street on a storm-damaged roof. Output the flat artwork only — no photo mockup, no scene, no perspective.`,
    ``,
    `TARP ANATOMY (non-negotiable): all branding lives in a TOP BAND covering roughly the upper 55-60% of the canvas. The remaining lower portion is SOLID MATTE BLACK and completely empty — it is the coverage zone that drapes over storm debris, so no text, logos, or graphics may appear there. A wavy American-flag ribbon runs along the bottom edge of the brand band, bleeding into the black zone as the only transition element${request.specialInstructions?.toLowerCase().includes("no flag") ? " — EXCEPT the customer asked for no flag imagery, so use a clean brand-colored wave instead" : ""}.`,
    ``,
    `Inside the top band:`,
    `- A thin uppercase strip across the very top edge listing the services: "${services.toUpperCase()}".`,
    `- Brand: ${request.businessName}. The first attached image is the company's real logo — reproduce it exactly (no redrawing, recoloring, or distortion) as a focal element. Build the palette from the logo's own colors plus white on a dark navy-to-black band background.`,
    `- Company name "${request.businessName}" in heavy sans-serif capitals.`,
    `- Phone number ${request.phone} — large, high-contrast, digits spelled exactly.`,
    `- Website ${request.website} in a smaller supporting size.`,
    request.vendorBadges?.length
      ? `- A row of clean trust-badge chips for: ${badges}. Simple bordered chips with the badge names; invent no extra award text.`
      : `- No vendor badge chips.`,
    `- RESERVED QR CORNER: keep the TOP-RIGHT corner of the band — a square area about ${qrPct}% of the image width, 2.5% in from the top and right edges — completely EMPTY of any text, graphics, boxes, or panels. Leave only the plain band background there: a real QR code on its own white panel is composited into that corner after generation. Do NOT draw a white square, frame, or placeholder QR yourself. You may point a small "SCAN FOR A QUOTE" callout at that corner from outside it.`,
    ``,
    `Layout mandate — ${style?.name ?? "standard"}: ${style?.mandate ?? "balanced professional layout."}`,
    hint ?? "",
    withReference
      ? `\nThe second attached image is a LAYOUT ANATOMY reference from a previous tarp: use it only for the structural pattern (tagline strip, brand block, badge row, flag wave, black zone). Do NOT copy its company name, colors, QR contents, or any small red measurement annotations.`
      : "",
    request.specialInstructions?.trim()
      ? `\nCustomer's special instructions: ${request.specialInstructions.trim()}`
      : "",
    ``,
    `Style: flat, vector-like print graphic. Crisp edges, solid fills, heavy typography, generous contrast, legible from 100 feet. No watermarks, no photos of people or houses.`,
  ]
  return lines.filter((l) => l !== "").join("\n")
}

export function buildRevisionPrompt(request: DesignRequestRow, note: string): string {
  return [
    `The first attached image is the current tarp design proof. Revise it per the customer's request below while keeping everything else — composition, brand colors, correct phone/website/business name spelling — intact.`,
    ``,
    `Customer's revision request: ${note.trim()}`,
    ``,
    `The second attached image is the company's original logo — keep its reproduction exact.`,
    `Non-negotiables: the white QR panel in the top-right corner is composited separately — keep that corner exactly as it is with nothing new entering it, and keep the lower solid-black coverage zone completely empty.`,
    `Output the full flat artwork, landscape 3:2, edge to edge, print-ready.`,
  ].join("\n")
}
