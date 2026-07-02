import { circle } from "@turf/circle"
import type { Feature, Polygon } from "geojson"

import { emit } from "@/lib/bus"
import { upsertStorm } from "./store"
import type { StormEvent, StormGeometry, StormMotion } from "./types"

export type InjectInput = {
  lat: number
  lng: number
  radiusMiles?: number
  eventType?: string
  severity?: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"
  durationMinutes?: number
  areaDesc?: string
  headline?: string
  /** Optional simulated cell motion so test alerts produce arrival ETAs. */
  motion?: {
    /** Direction of travel in degrees true (e.g. 106 = toward ESE). */
    headingDeg: number
    speedKt: number
    /** How far behind the target the cell starts, in miles (default 25). */
    leadMiles?: number
  }
}

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LNG_EQ = 111_320

/** Place a simulated cell `leadMiles` up-track so it arrives at the center. */
function buildFixtureMotion(
  lat: number,
  lng: number,
  motion: NonNullable<InjectInput["motion"]>,
  refTime: Date,
): StormMotion {
  const leadMeters = (motion.leadMiles ?? 25) * 1609.344
  const headingRad = (motion.headingDeg * Math.PI) / 180
  const mPerDegLng = M_PER_DEG_LNG_EQ * Math.cos(lat * (Math.PI / 180))
  return {
    refTime: refTime.toISOString(),
    headingDeg: motion.headingDeg,
    speedKt: motion.speedKt,
    points: [
      {
        lat: lat - (Math.cos(headingRad) * leadMeters) / M_PER_DEG_LAT,
        lng: lng - (Math.sin(headingRad) * leadMeters) / mPerDegLng,
      },
    ],
  }
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
    senderName: "Storm Sentry (simulated)",
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    endedAt: null,
    nwsUrl: null,
    geometry: poly.geometry as StormGeometry,
    motion: input.motion
      ? buildFixtureMotion(input.lat, input.lng, input.motion, startedAt)
      : null,
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
