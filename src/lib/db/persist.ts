import { eq, notInArray } from "drizzle-orm"

import { getDb, isDbConfigured } from "./client"
import { storms, tomorrowBudget, zipInsights } from "./schema"
import type { StormEvent } from "../storms/types"
import type { ZipInsightEvent } from "../zip-insights/types"

// Write-through persistence: the in-memory globalThis stores stay the hot read
// path (all callers unchanged, single-replica), every mutation is mirrored to
// Postgres fire-and-forget, and boot rehydrates memory from Postgres so storms
// and the ZIP-insight queue survive restarts/redeploys. All functions are
// no-ops without DATABASE_URL.

const ts = (iso: string | null | undefined): Date | null => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

function logErr(op: string) {
  return (err: unknown) => console.error(`[persist] ${op} failed`, err)
}

export function persistStorm(s: StormEvent): void {
  if (!isDbConfigured()) return
  const row = {
    id: s.id,
    source: s.source,
    sourceEventId: s.sourceEventId,
    eventType: s.eventType,
    severity: s.severity,
    certainty: s.certainty,
    urgency: s.urgency,
    headline: s.headline,
    description: s.description,
    instruction: s.instruction,
    areaDesc: s.areaDesc,
    senderName: s.senderName,
    startedAt: ts(s.startedAt),
    expiresAt: ts(s.expiresAt),
    endedAt: ts(s.endedAt),
    nwsUrl: s.nwsUrl,
    geometry: s.geometry,
    fetchedAt: ts(s.fetchedAt) ?? new Date(),
    updatedAt: new Date(),
  }
  void getDb()
    .insert(storms)
    .values(row)
    .onConflictDoUpdate({ target: storms.id, set: row })
    .catch(logErr("storm upsert"))
}

export function deleteStormRow(id: string): void {
  if (!isDbConfigured()) return
  void getDb().delete(storms).where(eq(storms.id, id)).catch(logErr("storm delete"))
}

export function persistZipInsight(e: ZipInsightEvent): void {
  if (!isDbConfigured()) return
  const row = {
    id: e.id,
    zip: e.zip,
    lat: e.lat,
    lng: e.lng,
    stormId: e.stormId,
    source: e.source,
    eventType: e.eventType,
    severity: e.severity,
    headline: e.headline,
    areaDesc: e.areaDesc,
    distanceMeters: e.distanceMeters,
    nowcast: e.nowcast,
    status: e.status,
    createdAt: ts(e.createdAt) ?? new Date(),
    updatedAt: ts(e.updatedAt) ?? new Date(),
    expiresAt: ts(e.expiresAt),
  }
  void getDb()
    .insert(zipInsights)
    .values(row)
    .onConflictDoUpdate({ target: zipInsights.id, set: row })
    .catch(logErr("zip insight upsert"))
}

/** Mirror of pruneZipInsights: drop rows whose storm is gone. */
export function pruneZipInsightRows(activeStormIds: string[]): void {
  if (!isDbConfigured()) return
  const q =
    activeStormIds.length === 0
      ? getDb().delete(zipInsights)
      : getDb().delete(zipInsights).where(notInArray(zipInsights.stormId, activeStormIds))
  void q.catch(logErr("zip insight prune"))
}

/** Mirror of the budget day counters so a redeploy can't reset spend to zero. */
export function persistBudgetCounters(snap: {
  dayKey: string
  dayCount: number
  kindDay: { events: number; nowcast: number; forecast: number }
  hourWindowStart: number
  hourCount: number
  totalCalls: number
  totalThrottled: number
}): void {
  if (!isDbConfigured()) return
  const row = {
    dayKey: snap.dayKey,
    dayCount: snap.dayCount,
    eventsDayCount: snap.kindDay.events,
    nowcastDayCount: snap.kindDay.nowcast,
    forecastDayCount: snap.kindDay.forecast,
    hourWindowStart: new Date(snap.hourWindowStart),
    hourCount: snap.hourCount,
    totalCalls: snap.totalCalls,
    totalThrottled: snap.totalThrottled,
    updatedAt: new Date(),
  }
  void getDb()
    .insert(tomorrowBudget)
    .values(row)
    .onConflictDoUpdate({ target: tomorrowBudget.dayKey, set: row })
    .catch(logErr("budget upsert"))
}

export type BudgetSeed = {
  dayKey: string
  dayCount: number
  kindDay: { events: number; nowcast: number; forecast: number }
  hourWindowStart: number
  hourCount: number
  totalCalls: number
  totalThrottled: number
}

/** Load everything back into the in-memory stores at boot. No bus emits. */
export async function hydrateFromDb(): Promise<{
  storms: number
  zipInsights: number
  budget: boolean
}> {
  if (!isDbConfigured()) return { storms: 0, zipInsights: 0, budget: false }
  const db = getDb()

  const stormRows = await db.select().from(storms)
  const { hydrateStorm } = await import("../storms/store")
  for (const r of stormRows) {
    hydrateStorm({
      id: r.id,
      source: r.source as StormEvent["source"],
      sourceEventId: r.sourceEventId,
      eventType: r.eventType,
      severity: r.severity,
      certainty: r.certainty,
      urgency: r.urgency,
      headline: r.headline,
      description: r.description,
      instruction: r.instruction,
      areaDesc: r.areaDesc,
      senderName: r.senderName,
      startedAt: iso(r.startedAt),
      expiresAt: iso(r.expiresAt),
      endedAt: iso(r.endedAt),
      nwsUrl: r.nwsUrl,
      geometry: r.geometry as StormEvent["geometry"],
      fetchedAt: iso(r.fetchedAt) ?? new Date().toISOString(),
    })
  }

  const ziRows = await db.select().from(zipInsights)
  const { hydrateZipInsight } = await import("../zip-insights/store")
  for (const r of ziRows) {
    hydrateZipInsight({
      id: r.id,
      zip: r.zip,
      lat: r.lat,
      lng: r.lng,
      stormId: r.stormId,
      source: r.source as ZipInsightEvent["source"],
      eventType: r.eventType,
      severity: r.severity,
      headline: r.headline,
      areaDesc: r.areaDesc,
      distanceMeters: r.distanceMeters,
      nowcast: r.nowcast,
      status: r.status as ZipInsightEvent["status"],
      createdAt: iso(r.createdAt) ?? new Date().toISOString(),
      updatedAt: iso(r.updatedAt) ?? new Date().toISOString(),
      expiresAt: iso(r.expiresAt),
    })
  }

  const dayKey = new Date().toISOString().slice(0, 10)
  const budgetRows = await db
    .select()
    .from(tomorrowBudget)
    .where(eq(tomorrowBudget.dayKey, dayKey))
    .limit(1)
  let budget = false
  if (budgetRows[0]) {
    const b = budgetRows[0]
    const { seedBudget } = await import("../tomorrow/budget")
    seedBudget({
      dayKey: b.dayKey,
      dayCount: b.dayCount,
      kindDay: {
        events: b.eventsDayCount,
        nowcast: b.nowcastDayCount,
        forecast: b.forecastDayCount,
      },
      hourWindowStart: b.hourWindowStart.getTime(),
      hourCount: b.hourCount,
      totalCalls: b.totalCalls,
      totalThrottled: b.totalThrottled,
    })
    budget = true
  }

  return { storms: stormRows.length, zipInsights: ziRows.length, budget }
}
