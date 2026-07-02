import { parseEventMotion } from "./eta"
import type { NwsFeature, StormEvent, StormGeometry, StormMotion } from "./types"

/** NWS timestamps carry local offsets ("2026-07-01T21:30:00-05:00"); store
 *  them as UTC ISO so string sorts and cross-source comparisons behave. */
function toUtcIso(value: string | null | undefined): string | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? value : new Date(t).toISOString()
}

export function normalizeNwsFeature(feature: NwsFeature, fetchedAt: string): StormEvent {
  const props = feature.properties
  const geometry: StormGeometry | null = feature.geometry as StormGeometry | null

  // Radar-derived cell motion (warned storms only) → minutes-to-arrival input.
  let motion: StormMotion | null = null
  const motionDesc = props.parameters?.eventMotionDescription?.[0]
  if (motionDesc) motion = parseEventMotion(motionDesc)

  return {
    id: feature.id,
    source: "nws",
    sourceEventId: props.id ?? feature.id,
    eventType: props.event,
    severity: props.severity ?? "Unknown",
    certainty: props.certainty ?? null,
    urgency: props.urgency ?? null,
    headline: props.headline ?? null,
    description: props.description ?? null,
    instruction: props.instruction ?? null,
    areaDesc: props.areaDesc ?? null,
    senderName: props.senderName ?? null,
    startedAt: toUtcIso(props.onset ?? props.effective ?? props.sent),
    expiresAt: toUtcIso(props.expires),
    endedAt: toUtcIso(props.ends),
    nwsUrl: feature.id,
    geometry,
    motion,
    fetchedAt,
  }
}
