import { bbox } from "@turf/bbox"
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import type { Feature, MultiPolygon, Polygon } from "geojson"

import { ZCTA_PACKED } from "./data/zcta-centroids"

// Full-US ZIP (ZCTA) centroids, parsed once from the bundled Census dataset.
// Server-only: imported solely by the poller / pipeline / API, never by a
// client component, so the ~766KB source never reaches the browser bundle.

export type ZipCentroid = { zip: string; lat: number; lng: number }

type ZipShape = { all: ZipCentroid[]; byZip: Map<string, ZipCentroid> }

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryZips: ZipShape | undefined
}

function parse(): ZipShape {
  const all: ZipCentroid[] = []
  const byZip = new Map<string, ZipCentroid>()
  for (const row of ZCTA_PACKED.split(";")) {
    if (!row) continue
    const comma1 = row.indexOf(",")
    const comma2 = row.indexOf(",", comma1 + 1)
    const zip = row.slice(0, comma1)
    const lat = Number(row.slice(comma1 + 1, comma2))
    const lng = Number(row.slice(comma2 + 1))
    if (!zip || Number.isNaN(lat) || Number.isNaN(lng)) continue
    const z: ZipCentroid = { zip, lat, lng }
    all.push(z)
    byZip.set(zip, z)
  }
  return { all, byZip }
}

function getStore(): ZipShape {
  if (!globalThis.__stormSentryZips) globalThis.__stormSentryZips = parse()
  return globalThis.__stormSentryZips
}

export function zipCount(): number {
  return getStore().all.length
}

export function getZip(zip: string): ZipCentroid | undefined {
  return getStore().byZip.get(zip)
}

/**
 * ZIP centroids that fall inside a storm polygon. Uses a cheap bounding-box
 * prefilter before the precise point-in-polygon test (same pattern as
 * businesses/matcher.ts) so it stays fast across all ~34k ZCTAs per storm.
 */
export function zipsInPolygon(geometry: Polygon | MultiPolygon): ZipCentroid[] {
  const feature: Feature<Polygon | MultiPolygon> = {
    type: "Feature",
    properties: {},
    geometry,
  }
  const [minX, minY, maxX, maxY] = bbox(feature)
  const hits: ZipCentroid[] = []
  for (const z of getStore().all) {
    if (z.lng < minX || z.lng > maxX || z.lat < minY || z.lat > maxY) continue
    if (booleanPointInPolygon([z.lng, z.lat], feature)) hits.push(z)
  }
  return hits
}
