import { listActiveStorms } from "@/lib/storms/store"
import { listBusinesses, listMatchesForBusiness, getLastAlertedAt } from "./store"
import type { BusinessWithStatus } from "./types"

export function listBusinessesWithStatus(): BusinessWithStatus[] {
  const storms = listActiveStorms()
  const stormById = new Map(storms.map((s) => [s.id, s]))
  const businesses = listBusinesses()

  return businesses.map((b) => {
    const matches = listMatchesForBusiness(b.id)
    const activeMatches = matches.filter((m) => stormById.has(m.stormId))
    let nearest: BusinessWithStatus["nearestStorm"] = null
    if (activeMatches.length) {
      const sorted = [...activeMatches].sort((a, c) => a.distanceMeters - c.distanceMeters)
      const m = sorted[0]
      const storm = stormById.get(m.stormId)
      if (storm) {
        nearest = {
          stormId: storm.id,
          eventType: storm.eventType,
          severity: storm.severity,
          distanceMeters: m.distanceMeters,
        }
      }
    }
    return {
      ...b,
      status: activeMatches.length > 0 ? "alerted" : "idle",
      activeMatchCount: activeMatches.length,
      nearestStorm: nearest,
      lastAlertedAt: getLastAlertedAt(b.id),
    }
  })
}
