import type { NwsFeature, StormEvent, StormGeometry } from "./types"

export function normalizeNwsFeature(feature: NwsFeature, fetchedAt: string): StormEvent {
  const props = feature.properties
  const geometry: StormGeometry | null = feature.geometry as StormGeometry | null

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
    startedAt: props.onset ?? props.effective ?? props.sent ?? null,
    expiresAt: props.expires ?? null,
    endedAt: props.ends ?? null,
    nwsUrl: feature.id,
    geometry,
    fetchedAt,
  }
}
