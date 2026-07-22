import { eq, sql } from "drizzle-orm"

import { getDb, isDbConfigured } from "@/lib/db/client"
import { qrLinks } from "@/lib/db/schema"
import { newQrSlug } from "@/lib/design/ids"
import { appBaseUrl } from "@/lib/app-url"

// Editable QR redirects. The QR printed on a tarp encodes qrUrl(slug) — a
// stable /q/{slug} URL on our origin — and this store owns where it lands.
// Retargeting is a single UPDATE; the printed code never changes.

export type QrLink = {
  slug: string
  targetUrl: string
  requestId: string | null
  createdByUserId: string | null
  label: string | null
  hits: number
  lastScanAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/** The URL a printed QR encodes. */
export function qrUrl(slug: string): string {
  return `${appBaseUrl()}/q/${slug}`
}

/**
 * Valid redirect destinations: web URLs and tel: (the form offers "call a
 * telephone number" as a QR action; browsers hand tel: redirects to the dialer).
 */
export function isValidQrTarget(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol === "http:" || url.protocol === "https:") return Boolean(url.hostname)
  if (url.protocol === "tel:") return url.pathname.replace(/[^0-9+]/g, "").length >= 7
  return false
}

/** Normalize customer-entered destinations: bare domains get https://. */
export function normalizeQrTarget(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  return isValidQrTarget(candidate) ? candidate : null
}

export async function createQrLink(input: {
  targetUrl: string
  requestId?: string | null
  createdByUserId?: string | null
  label?: string | null
}): Promise<QrLink> {
  const db = getDb()
  // Slug space is ~34 bits; collisions are vanishingly rare but retried anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = newQrSlug()
    try {
      const [row] = await db
        .insert(qrLinks)
        .values({
          slug,
          targetUrl: input.targetUrl,
          requestId: input.requestId ?? null,
          createdByUserId: input.createdByUserId ?? null,
          label: input.label ?? null,
        })
        .returning()
      return row
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code !== "23505") throw err // 23505 = unique_violation → retry with a new slug
    }
  }
  throw new Error("could not allocate a unique QR slug")
}

/**
 * Resolve a scan: bump the hit counter and return the destination in one
 * round-trip. Null for unknown slugs or when no DB is configured.
 */
export async function resolveAndTrackQr(slug: string): Promise<string | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb()
    .update(qrLinks)
    .set({ hits: sql`${qrLinks.hits} + 1`, lastScanAt: new Date() })
    .where(eq(qrLinks.slug, slug))
    .returning({ targetUrl: qrLinks.targetUrl })
  return rows[0]?.targetUrl ?? null
}

export async function getQrLink(slug: string): Promise<QrLink | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb().select().from(qrLinks).where(eq(qrLinks.slug, slug)).limit(1)
  return rows[0] ?? null
}

export async function getQrLinkForRequest(requestId: string): Promise<QrLink | null> {
  if (!isDbConfigured()) return null
  const rows = await getDb()
    .select()
    .from(qrLinks)
    .where(eq(qrLinks.requestId, requestId))
    .limit(1)
  return rows[0] ?? null
}

export async function updateQrTarget(slug: string, targetUrl: string): Promise<QrLink | null> {
  const rows = await getDb()
    .update(qrLinks)
    .set({ targetUrl, updatedAt: new Date() })
    .where(eq(qrLinks.slug, slug))
    .returning()
  return rows[0] ?? null
}
