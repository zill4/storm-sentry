import { getDb } from "@/lib/db/client"
import { designRequests } from "@/lib/db/schema"
import { newId } from "./ids"
import type { DesignRequestRow } from "./store"
import { DESIGN_STYLES, HOW_FOUND } from "./types"

// Google Form → design_requests mapping. The Apps Script forwarder (see
// docs/google-form-ingest.md) posts each submission's `namedValues` — the
// form's question titles mapped to answer arrays — which is also what the CSV
// backfill synthesizes from the response sheet's header row. Question titles
// are matched loosely (lowercased prefix) so trailing punctuation in the form
// doesn't break the mapping.

export type IngestPayload = {
  responseId?: string
  submittedAt?: string
  namedValues: Record<string, string[] | string>
}

function answer(named: Record<string, string[] | string>, titleStart: string): string | null {
  const key = Object.keys(named).find((k) =>
    k.trim().toLowerCase().startsWith(titleStart.toLowerCase()),
  )
  if (!key) return null
  const v = named[key]
  const joined = Array.isArray(v) ? v.filter(Boolean).join(", ") : v
  const trimmed = joined?.trim()
  return trimmed ? trimmed : null
}

function answerList(named: Record<string, string[] | string>, titleStart: string): string[] | null {
  const raw = answer(named, titleStart)
  if (!raw) return null
  const parts = raw
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : null
}

const STYLE_BY_NUMBER = ["authority", "lead_machine", "modern_star", "neighborhood_hero"] as const

function parseStyle(raw: string | null): string | null {
  if (!raw) return null
  const num = raw.match(/style\s*([1-4])/i)
  if (num) return STYLE_BY_NUMBER[Number(num[1]) - 1]
  const lower = raw.toLowerCase()
  const byName = DESIGN_STYLES.find((s) => lower.includes(s.name.toLowerCase()))
  return byName?.key ?? null
}

function parseQrAction(raw: string | null): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes("telephone") || lower.includes("call")) return "call"
  if (lower.includes("quote") || lower.includes("api")) return "quote"
  if (lower.includes("website") || lower.includes("web")) return "website"
  return null
}

function parseHowFound(raw: string | null): { howFound: string | null; other: string | null } {
  if (!raw) return { howFound: null, other: null }
  const known = HOW_FOUND.find((h) => raw.toLowerCase().startsWith(h.toLowerCase()))
  if (known && known !== "Other") return { howFound: known, other: null }
  return { howFound: "Other", other: raw.replace(/^other:?\s*/i, "").trim() || null }
}

export function mapIngestPayload(payload: IngestPayload) {
  const named = payload.namedValues
  const howFound = parseHowFound(answer(named, "How did you find us"))
  return {
    email: answer(named, "Email Address") ?? answer(named, "Email"),
    fullName: answer(named, "Full Name"),
    businessName: answer(named, "Business Name"),
    shippingAddress: answer(named, "Shipping Address"),
    phone: answer(named, "Phone Number"),
    website: answer(named, "Website"),
    qrAction: parseQrAction(answer(named, "What would you like your QR code")),
    services: answerList(named, "What Services"),
    vendorBadges: answerList(named, "What Vendor Badges"),
    howFound: howFound.howFound,
    howFoundOther: howFound.other,
    designStyle: parseStyle(answer(named, "REQUIRED: Choose Your Design Style")),
    specialInstructions: answer(named, "Special Design instructions"),
    consentTransactionalSms: Boolean(answer(named, "By checking this box, I consent to receive non-marketing")),
    consentMarketingSms: Boolean(
      answer(named, "By checking this box, I consent to receive marketing"),
    ),
  }
}

/**
 * Insert an ingested response (idempotent on responseId). Returns the row and
 * whether it was newly created.
 */
export async function ingestGoogleFormResponse(
  payload: IngestPayload,
): Promise<{ request: DesignRequestRow | null; created: boolean }> {
  const mapped = mapIngestPayload(payload)
  const db = getDb()
  const rows = await db
    .insert(designRequests)
    .values({
      id: newId("dr"),
      source: "google_form",
      status: "imported",
      googleFormResponseId: payload.responseId ?? null,
      rawPayload: payload as unknown as Record<string, unknown>,
      ...mapped,
      createdAt: payload.submittedAt ? new Date(payload.submittedAt) : undefined,
    })
    .onConflictDoNothing({ target: designRequests.googleFormResponseId })
    .returning()
  return { request: rows[0] ?? null, created: rows.length > 0 }
}
