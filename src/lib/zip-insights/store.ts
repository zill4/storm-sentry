import { emit } from "@/lib/bus"
import { persistZipInsight, pruneZipInsightRows } from "@/lib/db/persist"
import { severityRank } from "@/lib/storms/types"
import type { NowcastValues } from "@/lib/tomorrow/types"
import type { ZipInsightEvent, ZipInsightSeed } from "./types"

// In-memory queue of exportable ZIP-level storm insights, keyed by
// `${zip}:${stormId}`. Mirrors the businesses/store.ts pattern (globalThis map,
// idempotent upsert, bus events) so it survives dev HMR but resets on restart.

type Shape = { events: Map<string, ZipInsightEvent> }

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryZipInsights: Shape | undefined
}

function getStore(): Shape {
  if (!globalThis.__stormSentryZipInsights) {
    globalThis.__stormSentryZipInsights = { events: new Map() }
  }
  return globalThis.__stormSentryZipInsights
}

function keyOf(zip: string, stormId: string): string {
  return `${zip}:${stormId}`
}

export function listZipInsights(): ZipInsightEvent[] {
  return [...getStore().events.values()]
}

export function getZipInsight(id: string): ZipInsightEvent | undefined {
  return getStore().events.get(id)
}

/** Create or refresh a ZIP insight from storm-derived fields. Preserves an
 *  existing record's nowcast / status / createdAt. */
export function upsertZipInsight(seed: ZipInsightSeed): {
  event: ZipInsightEvent
  created: boolean
} {
  const store = getStore()
  const id = keyOf(seed.zip, seed.stormId)
  const now = new Date().toISOString()
  const existing = store.events.get(id)

  if (existing) {
    const updated: ZipInsightEvent = {
      ...existing,
      source: seed.source,
      eventType: seed.eventType,
      severity: seed.severity,
      headline: seed.headline,
      areaDesc: seed.areaDesc,
      distanceMeters: seed.distanceMeters,
      expiresAt: seed.expiresAt,
      updatedAt: now,
    }
    store.events.set(id, updated)
    persistZipInsight(updated)
    emit({ type: "zip_insight_updated", at: now, insight: updated })
    return { event: updated, created: false }
  }

  const created: ZipInsightEvent = {
    id,
    zip: seed.zip,
    lat: seed.lat,
    lng: seed.lng,
    stormId: seed.stormId,
    source: seed.source,
    eventType: seed.eventType,
    severity: seed.severity,
    headline: seed.headline,
    areaDesc: seed.areaDesc,
    distanceMeters: seed.distanceMeters,
    nowcast: null,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    expiresAt: seed.expiresAt,
  }
  store.events.set(id, created)
  persistZipInsight(created)
  emit({ type: "zip_insight_added", at: now, insight: created })
  return { event: created, created: true }
}

/** Boot-time restore from Postgres: populate memory without bus emits. */
export function hydrateZipInsight(event: ZipInsightEvent): void {
  getStore().events.set(event.id, event)
}

/** Attach Tomorrow.io nowcast data; promotes a queued insight to "enriched". */
export function setNowcast(id: string, nowcast: NowcastValues): void {
  const store = getStore()
  const existing = store.events.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const updated: ZipInsightEvent = {
    ...existing,
    nowcast,
    status: existing.status === "exported" ? "exported" : "enriched",
    updatedAt: now,
  }
  store.events.set(id, updated)
  persistZipInsight(updated)
  emit({ type: "zip_insight_updated", at: now, insight: updated })
}

export function markExported(ids: string[]): number {
  const store = getStore()
  const now = new Date().toISOString()
  let n = 0
  for (const id of ids) {
    const existing = store.events.get(id)
    if (!existing || existing.status === "exported") continue
    const updated: ZipInsightEvent = { ...existing, status: "exported", updatedAt: now }
    store.events.set(id, updated)
    persistZipInsight(updated)
    emit({ type: "zip_insight_updated", at: now, insight: updated })
    n++
  }
  return n
}

/** Drop insights whose storm is no longer active (expired/removed). */
export function pruneZipInsights(activeStormIds: Set<string>): number {
  const store = getStore()
  let removed = 0
  for (const [id, ev] of store.events) {
    if (!activeStormIds.has(ev.stormId)) {
      store.events.delete(id)
      removed++
    }
  }
  if (removed > 0) pruneZipInsightRows([...activeStormIds])
  return removed
}

export function zipInsightStats() {
  const all = listZipInsights()
  return {
    total: all.length,
    enriched: all.filter((e) => e.nowcast != null).length,
    exported: all.filter((e) => e.status === "exported").length,
    severe: all.filter((e) => severityRank(e.severity) >= 3).length,
    distinctZips: new Set(all.map((e) => e.zip)).size,
  }
}
