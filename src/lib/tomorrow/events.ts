import { listActiveStorms, upsertStorm } from "@/lib/storms/store"
import type { StormEvent, StormGeometry } from "@/lib/storms/types"
import { canSpend } from "./budget"
import { getEvents, TomorrowBudgetExceeded } from "./client"
import { INSIGHT_CATEGORIES, titleCaseSeverity, type TomorrowEvent } from "./types"

// CONUS split into two polygons, each well under the Events API's 10M km² cap
// (~6.7M west, ~7.8M east). AK/HI/territories are covered by the direct NWS
// feed, not this sweep.
const CONUS_WEST: number[][][] = [
  [
    [-125, 49.5],
    [-98, 49.5],
    [-98, 24.5],
    [-125, 24.5],
    [-125, 49.5],
  ],
]
const CONUS_EAST: number[][][] = [
  [
    [-98, 49.5],
    [-66.5, 49.5],
    [-66.5, 24.5],
    [-98, 24.5],
    [-98, 49.5],
  ],
]

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryEventsPollAt: number | undefined
}

// US Tomorrow.io events are re-served NWS alerts; their link embeds the NWS
// urn. We pull that out to dedup against the storms our direct NWS poll already
// holds (NWS is authoritative, so we drop the Tomorrow copy).
function extractNwsUrn(s: string | null | undefined): string | null {
  if (!s) return null
  let decoded = s
  try {
    decoded = decodeURIComponent(s)
  } catch {
    /* keep raw */
  }
  const m = decoded.match(/urn:oid:[0-9a-f.]+/i)
  return m ? m[0] : null
}

function normalizeEvent(ev: TomorrowEvent, fetchedAt: string): StormEvent | null {
  const loc = ev.eventValues.location
  let geometry: StormGeometry | null = null
  if (loc?.type === "Polygon") {
    geometry = { type: "Polygon", coordinates: loc.coordinates as number[][][] }
  } else if (loc?.type === "MultiPolygon") {
    geometry = { type: "MultiPolygon", coordinates: loc.coordinates as number[][][][] }
  }

  const urn = extractNwsUrn(ev.eventValues.link)
  const id = `tomorrow:${urn ?? `${ev.eventValues.title ?? ev.insight}:${ev.startTime ?? ""}`}`
  const instruction =
    ev.eventValues.response
      ?.map((r) => r.instruction)
      .filter((x): x is string => Boolean(x))
      .join("\n\n") || null

  return {
    id,
    source: "tomorrow",
    sourceEventId: urn ?? id,
    eventType: ev.eventValues.title ?? ev.insight,
    severity: titleCaseSeverity(ev.severity),
    certainty: ev.certainty ?? null,
    urgency: ev.urgency ?? null,
    headline: ev.eventValues.headline ?? null,
    description: ev.eventValues.description ?? null,
    instruction,
    areaDesc: null,
    senderName: ev.eventValues.origin ?? "Tomorrow.io",
    startedAt: ev.startTime ?? null,
    expiresAt: ev.endTime ?? null,
    endedAt: null,
    nwsUrl: ev.eventValues.link ?? null,
    geometry,
    fetchedAt,
  }
}

export type EventsPollResult = {
  ran: boolean
  reason?: string
  ingested: number
  deduped: number
  skippedNoGeometry: number
}

/**
 * Sweep CONUS for severe-weather events on a slow cadence (default 30 min) to
 * conserve the events sub-budget. Self-gates on the interval and the budget;
 * `force` ignores the interval (still budget-gated).
 */
export async function pollTomorrowEvents(opts?: {
  force?: boolean
}): Promise<EventsPollResult> {
  const base = { ingested: 0, deduped: 0, skippedNoGeometry: 0 }
  const intervalMs = Number(process.env.TOMORROW_EVENTS_INTERVAL_SECONDS ?? 1800) * 1000
  const now = Date.now()

  if (!opts?.force) {
    const last = globalThis.__stormSentryEventsPollAt ?? 0
    if (now - last < intervalMs) return { ran: false, reason: "interval not elapsed", ...base }
  }
  if (!canSpend("events")) return { ran: false, reason: "events budget exhausted", ...base }
  globalThis.__stormSentryEventsPollAt = now

  const fetchedAt = new Date().toISOString()
  const seenUrns = new Set<string>()
  for (const s of listActiveStorms()) {
    if (s.source !== "nws") continue
    const u = extractNwsUrn(s.id) ?? extractNwsUrn(s.nwsUrl)
    if (u) seenUrns.add(u)
  }

  let ingested = 0
  let deduped = 0
  let skippedNoGeometry = 0

  for (const polygon of [CONUS_WEST, CONUS_EAST]) {
    let events: TomorrowEvent[]
    try {
      events = await getEvents(polygon, INSIGHT_CATEGORIES)
    } catch (err) {
      if (err instanceof TomorrowBudgetExceeded) break
      console.error("[tomorrow-events] fetch failed", err)
      continue
    }
    for (const ev of events) {
      const urn = extractNwsUrn(ev.eventValues.link)
      if (urn && seenUrns.has(urn)) {
        deduped++
        continue
      }
      const storm = normalizeEvent(ev, fetchedAt)
      if (!storm) continue
      if (!storm.geometry) {
        skippedNoGeometry++
        continue
      }
      upsertStorm(storm)
      ingested++
      if (urn) seenUrns.add(urn)
    }
  }

  return { ran: true, ingested, deduped, skippedNoGeometry }
}
