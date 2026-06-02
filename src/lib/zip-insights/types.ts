import type { StormEvent } from "@/lib/storms/types"
import type { NowcastValues } from "@/lib/tomorrow/types"

export type ZipInsightStatus = "queued" | "enriched" | "exported"

/**
 * One ZIP threatened by one storm — the exportable unit. Identity is
 * `${zip}:${stormId}` so the same ZIP+storm never queues twice. Storm-derived
 * fields refresh each cycle; `nowcast` is filled lazily from Tomorrow.io for
 * the highest-priority ZIPs within budget.
 */
export type ZipInsightEvent = {
  id: string
  zip: string
  lat: number
  lng: number
  stormId: string
  source: StormEvent["source"]
  eventType: string
  severity: string
  headline: string | null
  areaDesc: string | null
  /** ZIP centroid → storm centroid, meters. */
  distanceMeters: number
  nowcast: NowcastValues | null
  status: ZipInsightStatus
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

/** Storm-derived fields the pipeline upserts each cycle (no nowcast/status). */
export type ZipInsightSeed = {
  zip: string
  lat: number
  lng: number
  stormId: string
  source: StormEvent["source"]
  eventType: string
  severity: string
  headline: string | null
  areaDesc: string | null
  distanceMeters: number
  expiresAt: string | null
}
