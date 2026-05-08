import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import { buffer } from "@turf/buffer"
import { distance } from "@turf/distance"
import { centroid } from "@turf/centroid"
import { point as turfPoint } from "@turf/helpers"
import type { Feature, MultiPolygon, Polygon } from "geojson"

import { emit } from "@/lib/bus"
import { listActiveStorms } from "@/lib/storms/store"
import type { StormEvent } from "@/lib/storms/types"
import { getBusiness, listBusinesses, pruneMatches, recordMatch } from "./store"

const DEFAULT_RADIUS_METERS = Number(process.env.MATCH_RADIUS_METERS ?? 8047)

type RunResult = {
  storms: number
  stormsWithGeometry: number
  businesses: number
  matchesCreated: number
  matchesExisting: number
  matchesPruned: number
  durationMs: number
}

export function runMatcher(
  radiusMeters: number = DEFAULT_RADIUS_METERS,
): RunResult {
  const start = Date.now()
  const storms = listActiveStorms()
  const businesses = listBusinesses()

  const activeIds = new Set(storms.map((s) => s.id))
  const matchesPruned = pruneMatches(activeIds)

  const stormsWithGeom = storms.filter((s) => s.geometry)
  let matchesCreated = 0
  let matchesExisting = 0

  for (const storm of stormsWithGeom) {
    const stormFeature: Feature<Polygon | MultiPolygon> = {
      type: "Feature",
      properties: {},
      geometry: storm.geometry as Polygon | MultiPolygon,
    }
    let buffered: Feature<Polygon | MultiPolygon> | undefined
    try {
      const out = buffer(stormFeature, radiusMeters / 1000, { units: "kilometers" })
      buffered = out as Feature<Polygon | MultiPolygon> | undefined
    } catch (err) {
      console.warn(`[matcher] buffer failed for storm ${storm.id}:`, err)
      continue
    }
    if (!buffered) continue

    const stormCentroid = centroid(stormFeature).geometry.coordinates as [number, number]

    for (const biz of businesses) {
      const bizPt = turfPoint([biz.lng, biz.lat])
      if (!booleanPointInPolygon(bizPt, buffered)) continue
      const distanceKm = distance(stormCentroid, bizPt.geometry.coordinates as [number, number], {
        units: "kilometers",
      })
      const match = {
        id: `${biz.id}:${storm.id}`,
        businessId: biz.id,
        stormId: storm.id,
        distanceMeters: Math.round(distanceKm * 1000),
        createdAt: new Date().toISOString(),
      }
      const result = recordMatch(match)
      if (result === "created") {
        matchesCreated++
        const fullBiz = getBusiness(biz.id)
        if (fullBiz) {
          emit({
            type: "match_created",
            at: match.createdAt,
            match,
            business: fullBiz,
            storm,
          })
        }
      } else {
        matchesExisting++
      }
    }
  }

  return {
    storms: storms.length,
    stormsWithGeometry: stormsWithGeom.length,
    businesses: businesses.length,
    matchesCreated,
    matchesExisting,
    matchesPruned,
    durationMs: Date.now() - start,
  }
}

// Helper used by API surface: assemble status for every business.
export function summarizeBusinessStatus(businessId: string, storms: StormEvent[]) {
  // Find all active matches for this business by reading store directly.
  // Avoid circular import: reimport at call site to keep matcher pure.
  return { businessId, storms }
}
