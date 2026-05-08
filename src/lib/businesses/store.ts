import { emit } from "@/lib/bus"
import { SEEDED_BUSINESSES } from "./seed"
import type { Business, StormMatch } from "./types"

type BusinessShape = {
  businesses: Map<string, Business>
  // Key: `${businessId}:${stormId}` (idempotency key). One row per business+storm pair.
  matches: Map<string, StormMatch>
  // businessId -> last alerted ISO timestamp (across all matches).
  lastAlertedAt: Map<string, string>
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryBusinesses: BusinessShape | undefined
}

function getStore(): BusinessShape {
  if (!globalThis.__stormSentryBusinesses) {
    const businesses = new Map<string, Business>()
    for (const b of SEEDED_BUSINESSES) businesses.set(b.id, b)
    globalThis.__stormSentryBusinesses = {
      businesses,
      matches: new Map(),
      lastAlertedAt: new Map(),
    }
  }
  return globalThis.__stormSentryBusinesses
}

export function listBusinesses(): Business[] {
  return [...getStore().businesses.values()]
}

export function getBusiness(id: string): Business | undefined {
  return getStore().businesses.get(id)
}

export function listMatches(): StormMatch[] {
  return [...getStore().matches.values()]
}

export function getMatch(idempotencyKey: string): StormMatch | undefined {
  return getStore().matches.get(idempotencyKey)
}

export function recordMatch(match: StormMatch): "created" | "exists" {
  const store = getStore()
  const key = `${match.businessId}:${match.stormId}`
  if (store.matches.has(key)) return "exists"
  store.matches.set(key, { ...match, id: key })
  store.lastAlertedAt.set(match.businessId, match.createdAt)
  return "created"
}

export function getLastAlertedAt(businessId: string): string | null {
  return getStore().lastAlertedAt.get(businessId) ?? null
}

// Drop matches whose underlying storm is no longer present (expired/removed).
export function pruneMatches(activeStormIds: Set<string>): number {
  const store = getStore()
  let removed = 0
  for (const [key, m] of store.matches) {
    if (!activeStormIds.has(m.stormId)) {
      store.matches.delete(key)
      removed++
    }
  }
  if (removed > 0) {
    emit({ type: "matches_pruned", at: new Date().toISOString(), count: removed })
  }
  return removed
}

export function listMatchesForBusiness(businessId: string): StormMatch[] {
  return [...getStore().matches.values()].filter((m) => m.businessId === businessId)
}

export function listMatchesForStorm(stormId: string): StormMatch[] {
  return [...getStore().matches.values()].filter((m) => m.stormId === stormId)
}
