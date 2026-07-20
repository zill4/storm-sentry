import { and, desc, gte, inArray } from "drizzle-orm"

import { getDb, isDbConfigured } from "@/lib/db/client"
import { zipAlertEvents } from "@/lib/db/schema"

// Read side of the zip_alert_events history table (written by the alert gate).
// Powers the "recent alerts" tail on /zip/{zip}, including nearby ZIPs. All
// queries are no-ops without DATABASE_URL (dev without a DB just hides the
// section).

export type ZipAlertHistoryRow = {
  id: string
  zip: string
  stormId: string
  source: string
  eventType: string
  severity: string
  headline: string | null
  etaMinutes: number | null
  expiresAt: string | null
  recordedAt: string
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

/** Recent history rows for a set of ZIPs, newest first. */
export async function recentAlertHistory(opts: {
  zips: string[]
  days?: number
  limit?: number
}): Promise<ZipAlertHistoryRow[]> {
  if (!isDbConfigured() || opts.zips.length === 0) return []
  const since = new Date(Date.now() - (opts.days ?? 30) * 24 * 60 * 60 * 1000)
  try {
    const rows = await getDb()
      .select()
      .from(zipAlertEvents)
      .where(and(inArray(zipAlertEvents.zip, opts.zips), gte(zipAlertEvents.recordedAt, since)))
      .orderBy(desc(zipAlertEvents.recordedAt))
      .limit(opts.limit ?? 40)
    return rows.map((r) => ({
      id: r.id,
      zip: r.zip,
      stormId: r.stormId,
      source: r.source,
      eventType: r.eventType,
      severity: r.severity,
      headline: r.headline,
      etaMinutes: r.etaMinutes,
      expiresAt: iso(r.expiresAt),
      recordedAt: iso(r.recordedAt) ?? new Date().toISOString(),
    }))
  } catch (err) {
    console.error("[alert-history] query failed", err)
    return []
  }
}
