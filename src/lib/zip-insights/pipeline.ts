import { estimateEta } from "@/lib/storms/eta"
import { listActiveStorms } from "@/lib/storms/store"
import { canSpend } from "@/lib/tomorrow/budget"
import { enrichZip, getCachedNowcast } from "@/lib/tomorrow/nowcast"
import { findThreatenedZips } from "@/lib/zips/intersect"
import { getZipInsight, pruneZipInsights, setNowcast, upsertZipInsight } from "./store"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type ZipInsightRunResult = {
  threatenedZips: number
  created: number
  updated: number
  enriched: number
  cachedApplied: number
  pruned: number
  durationMs: number
}

/**
 * Core ZIP pipeline, run every poll cycle:
 *  1. Intersect active storm polygons with US ZIP centroids.
 *  2. Upsert one queued insight per threatened ZIP (works off NWS alone — no
 *     Tomorrow.io required).
 *  3. Spend a small, budgeted number of Realtime calls on the highest-priority
 *     ZIPs to attach a quantitative nowcast; apply any fresh cache for free.
 */
export async function runZipInsights(): Promise<ZipInsightRunResult> {
  const start = Date.now()
  const storms = listActiveStorms()
  const threatened = findThreatenedZips(storms)

  const pruned = pruneZipInsights(new Set(storms.map((s) => s.id)))

  let created = 0
  let updated = 0
  const now = new Date()
  for (const t of threatened) {
    // Minutes-to-arrival from radar motion (or future onset); recomputed each
    // cycle so it decays correctly as the cell closes in.
    const eta = estimateEta(t.storm, t.lat, t.lng, now)
    const { created: wasCreated } = upsertZipInsight({
      zip: t.zip,
      lat: t.lat,
      lng: t.lng,
      stormId: t.storm.id,
      source: t.storm.source,
      eventType: t.storm.eventType,
      severity: t.storm.severity,
      headline: t.storm.headline,
      areaDesc: t.storm.areaDesc,
      distanceMeters: t.distanceMeters,
      etaMinutes: eta?.minutes ?? null,
      etaSource: eta?.source ?? null,
      expiresAt: t.storm.expiresAt,
    })
    if (wasCreated) created++
    else updated++
  }

  // Enrich the most-threatened ZIPs. Cached values are applied for free; only
  // fresh fetches count against the per-cycle cap and the nowcast budget.
  const perCycle = Number(process.env.TOMORROW_NOWCAST_PER_CYCLE ?? 5)
  let enriched = 0
  let cachedApplied = 0
  for (const t of threatened) {
    const id = `${t.zip}:${t.storm.id}`
    const ev = getZipInsight(id)

    const cached = getCachedNowcast(t.zip)
    if (cached) {
      if (ev && !ev.nowcast) {
        setNowcast(id, cached)
        cachedApplied++
      }
      continue
    }
    if (ev?.nowcast) continue // already enriched recently
    if (enriched >= perCycle) continue
    if (!canSpend("nowcast")) break

    const { values, spent } = await enrichZip(t.zip)
    if (values) setNowcast(id, values)
    if (spent) {
      enriched++
      await sleep(400) // keep comfortably under the 3 req/sec window
    }
  }

  return {
    threatenedZips: threatened.length,
    created,
    updated,
    enriched,
    cachedApplied,
    pruned,
    durationMs: Date.now() - start,
  }
}
