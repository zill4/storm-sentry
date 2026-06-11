import { circle } from "@turf/circle"
import type { Feature, Polygon } from "geojson"

import { emit } from "@/lib/bus"
import { upsertStorm } from "./store"
import type { StormEvent, StormGeometry } from "./types"

export type InjectInput = {
  lat: number
  lng: number
  radiusMiles?: number
  eventType?: string
  severity?: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"
  durationMinutes?: number
  areaDesc?: string
  headline?: string
}

export function injectFixtureStorm(input: InjectInput): StormEvent {
  const radiusMiles = input.radiusMiles ?? 8
  const radiusKm = radiusMiles * 1.609344
  const eventType = input.eventType ?? "Severe Thunderstorm Warning"
  const severity = input.severity ?? "Severe"
  const durationMinutes = input.durationMinutes ?? 60

  const poly = circle([input.lng, input.lat], radiusKm, {
    steps: 64,
    units: "kilometers",
  }) as Feature<Polygon>

  const startedAt = new Date()
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000)
  const id = `fixture:${startedAt.getTime()}:${input.lat.toFixed(3)},${input.lng.toFixed(3)}`

  const storm: StormEvent = {
    id,
    source: "fixture",
    sourceEventId: id,
    eventType,
    severity,
    certainty: "Observed",
    urgency: "Immediate",
    headline:
      input.headline ?? `[FIXTURE] ${eventType} ${radiusMiles}mi radius`,
    description: "Fixture storm injected via /api/replay for demo/testing.",
    instruction: null,
    areaDesc: input.areaDesc ?? `Fixture region around ${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}`,
    senderName: "Storm Sentry POC (fixture)",
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    endedAt: null,
    nwsUrl: null,
    geometry: poly.geometry as StormGeometry,
    fetchedAt: startedAt.toISOString(),
  }
  upsertStorm(storm)
  return storm
}

export function clearFixtureStorms(): number {
  const store = (globalThis as unknown as {
    __stormSentryStore?: { storms: Map<string, StormEvent> }
  }).__stormSentryStore
  if (!store) return 0
  let removed = 0
  const at = new Date().toISOString()
  for (const [id, s] of store.storms) {
    if (s.source === "fixture") {
      store.storms.delete(id)
      removed++
      emit({ type: "storm_removed", at, stormId: id })
      void import("@/lib/db/persist").then((m) => m.deleteStormRow(id))
    }
  }
  if (removed > 0) {
    emit({ type: "fixtures_cleared", at, count: removed })
  }
  return removed
}
