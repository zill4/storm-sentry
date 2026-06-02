import { centroid } from "@turf/centroid"
import { distance } from "@turf/distance"
import type { MultiPolygon, Polygon } from "geojson"

import { severityRank, type StormEvent } from "@/lib/storms/types"
import { zipsInPolygon, type ZipCentroid } from "./store"

export type ThreatenedZip = {
  zip: string
  lat: number
  lng: number
  storm: StormEvent
  /** ZIP centroid → storm centroid, meters. */
  distanceMeters: number
  /** Higher = enrich first. Severity dominates; ties broken by proximity. */
  priority: number
}

/**
 * Resolve active storm polygons to the ZIP centroids they cover. A ZIP can sit
 * under several alerts at once; we keep the highest-priority storm per ZIP.
 * Result is sorted by priority so callers can spend a limited nowcast budget on
 * the most threatened ZIPs first.
 */
export function findThreatenedZips(storms: StormEvent[]): ThreatenedZip[] {
  const best = new Map<string, ThreatenedZip>()

  for (const storm of storms) {
    if (!storm.geometry) continue
    const geom = storm.geometry as Polygon | MultiPolygon

    let stormCentroid: [number, number]
    try {
      stormCentroid = centroid({ type: "Feature", properties: {}, geometry: geom })
        .geometry.coordinates as [number, number]
    } catch {
      continue
    }

    const rank = severityRank(storm.severity)
    let hits: ZipCentroid[]
    try {
      hits = zipsInPolygon(geom)
    } catch {
      continue
    }

    for (const z of hits) {
      const distKm = distance(stormCentroid, [z.lng, z.lat], { units: "kilometers" })
      const priority = rank * 1000 - distKm
      const existing = best.get(z.zip)
      if (!existing || priority > existing.priority) {
        best.set(z.zip, {
          zip: z.zip,
          lat: z.lat,
          lng: z.lng,
          storm,
          distanceMeters: Math.round(distKm * 1000),
          priority,
        })
      }
    }
  }

  return [...best.values()].sort((a, b) => b.priority - a.priority)
}
