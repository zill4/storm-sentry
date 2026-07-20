import { sql } from "drizzle-orm"

import { emit, subscribe } from "@/lib/bus"
import { getDb, isDbConfigured } from "@/lib/db/client"
import { zipAlertEvents, zipAlerts } from "@/lib/db/schema"
import { severityRank } from "@/lib/storms/types"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"

// The single server-side "should we alert this ZIP?" gate. It sits between the
// ZIP-insight pipeline and every outbound channel (webhook → Zapier, GHL
// notifier), so both are filtered identically with no config needed on
// Zapier/GHL. Everything is keyed by ZIP — no contact/CMS knowledge:
//   - severity gate: only ≥ ALERT_MIN_SEVERITY (default Severe)
//   - fixture exclusion unless ALERT_ALLOW_FIXTURES=true
//   - per-ZIP cooldown (ALERT_ZIP_COOLDOWN_HOURS, default 24): a ZIP triggers at
//     most once per window, even as NWS renews a warning under new storm IDs.
// On pass it records the ZIP (persisted, hydrated at boot) and emits `zip_alert`
// — the event the outbound channels actually consume.

type Stats = {
  emitted: number
  skippedSeverity: number
  skippedFixture: number
  skippedCooldown: number
  lastEmitAt: string | null
}

type Shape = {
  // zip → epoch ms of last emitted alert (cooldown gate; hydrated at boot)
  lastAlertedAt: Map<string, number>
  // `${zip}:${stormId}` → severity already written to zip_alert_events, so the
  // chatty zip_insight_updated stream doesn't hammer the history table.
  recordedEvents: Map<string, string>
  stats: Stats
  unsubscribe?: () => void
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryAlertGate: Shape | undefined
}

function getShape(): Shape {
  if (!globalThis.__stormSentryAlertGate) {
    globalThis.__stormSentryAlertGate = {
      lastAlertedAt: new Map(),
      recordedEvents: new Map(),
      stats: {
        emitted: 0,
        skippedSeverity: 0,
        skippedFixture: 0,
        skippedCooldown: 0,
        lastEmitAt: null,
      },
    }
  }
  return globalThis.__stormSentryAlertGate
}

function minRank(): number {
  return severityRank(process.env.ALERT_MIN_SEVERITY ?? "Severe")
}

/** Per-ZIP cooldown window in ms (0 disables). Default 24h → each ZIP alerts at
 *  most once a day no matter how many warnings renew over the event. */
function cooldownMs(): number {
  const hours = Number(process.env.ALERT_ZIP_COOLDOWN_HOURS ?? 24)
  return Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : 0
}

function recordZipAlert(insight: ZipInsightEvent): void {
  if (!isDbConfigured()) return
  const now = new Date()
  void getDb()
    .insert(zipAlerts)
    .values({
      zip: insight.zip,
      lastStormId: insight.stormId,
      lastSeverity: insight.severity,
      lastAlertedAt: now,
      alertCount: 1,
    })
    .onConflictDoUpdate({
      target: zipAlerts.zip,
      set: {
        lastStormId: insight.stormId,
        lastSeverity: insight.severity,
        lastAlertedAt: now,
        alertCount: sql`${zipAlerts.alertCount} + 1`,
      },
    })
    .catch((err) => console.error("[alert-gate] persist failed", err))
}

/** Append to the per-ZIP severe-weather history (zip_alert_events). Runs for
 *  every severity-passing, non-fixture insight — including ones the cooldown
 *  later suppresses — so /zip/{zip} can show storm activity, not just sends. */
function recordHistory(insight: ZipInsightEvent): void {
  if (!isDbConfigured()) return
  const s = getShape()
  const id = `${insight.zip}:${insight.stormId}`
  if (s.recordedEvents.get(id) === insight.severity) return
  if (s.recordedEvents.size > 50_000) s.recordedEvents.clear() // leak guard
  s.recordedEvents.set(id, insight.severity)
  const row = {
    id,
    zip: insight.zip,
    stormId: insight.stormId,
    source: insight.source,
    eventType: insight.eventType,
    severity: insight.severity,
    headline: insight.headline,
    etaMinutes: insight.etaMinutes,
    expiresAt: insight.expiresAt ? new Date(insight.expiresAt) : null,
  }
  void getDb()
    .insert(zipAlertEvents)
    .values(row)
    .onConflictDoUpdate({
      target: zipAlertEvents.id,
      // Severity can upgrade in place (Moderate → Severe re-issue); keep the row current.
      set: {
        eventType: row.eventType,
        severity: row.severity,
        headline: row.headline,
        etaMinutes: row.etaMinutes,
        expiresAt: row.expiresAt,
      },
    })
    .catch((err) => console.error("[alert-gate] history persist failed", err))
}

function consider(insight: ZipInsightEvent): void {
  const s = getShape()
  if (severityRank(insight.severity) < minRank()) {
    s.stats.skippedSeverity++
    return
  }
  if (insight.source === "fixture" && process.env.ALERT_ALLOW_FIXTURES !== "true") {
    s.stats.skippedFixture++
    return
  }
  recordHistory(insight)
  const cd = cooldownMs()
  if (cd > 0) {
    const last = s.lastAlertedAt.get(insight.zip)
    if (last != null && Date.now() - last < cd) {
      s.stats.skippedCooldown++
      return
    }
  }
  const at = new Date().toISOString()
  s.lastAlertedAt.set(insight.zip, Date.now())
  recordZipAlert(insight)
  s.stats.emitted++
  s.stats.lastEmitAt = at
  emit({ type: "zip_alert", at, insight })
}

export function alertGateStats(): Stats & { trackedZips: number; cooldownHours: number } {
  const s = getShape()
  return {
    ...s.stats,
    trackedZips: s.lastAlertedAt.size,
    cooldownHours: cooldownMs() / 3_600_000,
  }
}

export async function startAlertGate(): Promise<{ started: boolean; reason?: string }> {
  const s = getShape()
  if (s.unsubscribe) return { started: false, reason: "already running" }

  // Hydrate per-ZIP cooldown times so a redeploy mid-event can't re-fire.
  if (isDbConfigured()) {
    try {
      const rows = await getDb()
        .select({ zip: zipAlerts.zip, last: zipAlerts.lastAlertedAt })
        .from(zipAlerts)
      for (const r of rows) {
        if (r.last) s.lastAlertedAt.set(r.zip, new Date(r.last).getTime())
      }
    } catch (err) {
      console.error("[alert-gate] hydration failed (continuing empty)", err)
    }
  }

  // Consider on both create and in-place severity upgrades; the cooldown makes
  // the repeated `updated` events cheap no-ops.
  s.unsubscribe = subscribe((event) => {
    if (event.type === "zip_insight_added" || event.type === "zip_insight_updated") {
      consider(event.insight)
    }
  })
  return { started: true }
}
