import { emit } from "@/lib/bus"
import { deleteStormRow, persistStorm } from "@/lib/db/persist"
import type { StormEvent } from "./types"

export type PollerStatus = {
  startedAt: string | null
  lastPollAt: string | null
  lastPollOk: boolean | null
  lastPollError: string | null
  totalPolls: number
  totalAlertsSeen: number
  totalAcceptedAlerts: number
  totalSkippedNoGeometry: number
  pollIntervalSeconds: number
  enabled: boolean
}

type StoreShape = {
  storms: Map<string, StormEvent>
  poller: PollerStatus
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryStore: StoreShape | undefined
}

function getStore(): StoreShape {
  if (!globalThis.__stormSentryStore) {
    globalThis.__stormSentryStore = {
      storms: new Map(),
      poller: {
        startedAt: null,
        lastPollAt: null,
        lastPollOk: null,
        lastPollError: null,
        totalPolls: 0,
        totalAlertsSeen: 0,
        totalAcceptedAlerts: 0,
        totalSkippedNoGeometry: 0,
        pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS ?? 60),
        enabled: process.env.ENABLE_NWS_POLLER !== "false",
      },
    }
  }
  return globalThis.__stormSentryStore
}

export function listActiveStorms(): StormEvent[] {
  // Epoch-based compare: NWS timestamps carry local offsets ("…-05:00"), so a
  // lexicographic compare against a UTC "now" string silently drops fresh
  // evening warnings once UTC rolls past midnight.
  const now = Date.now()
  return [...getStore().storms.values()].filter((s) => {
    if (!s.expiresAt) return true
    const t = new Date(s.expiresAt).getTime()
    return Number.isNaN(t) ? true : t > now
  })
}

export function listAllStorms(): StormEvent[] {
  return [...getStore().storms.values()]
}

export function upsertStorm(storm: StormEvent): "created" | "updated" {
  const store = getStore()
  const existed = store.storms.has(storm.id)
  store.storms.set(storm.id, storm)
  persistStorm(storm)
  const at = new Date().toISOString()
  emit(existed ? { type: "storm_updated", at, storm } : { type: "storm_added", at, storm })
  return existed ? "updated" : "created"
}

/** Boot-time restore from Postgres: populate memory without bus emits. */
export function hydrateStorm(storm: StormEvent): void {
  getStore().storms.set(storm.id, storm)
}

export function removeExpiredStorms(): number {
  const store = getStore()
  const nowMs = Date.now()
  const at = new Date().toISOString()
  let removed = 0
  for (const [id, s] of store.storms) {
    if (!s.expiresAt) continue
    const t = new Date(s.expiresAt).getTime()
    // Epoch compare (see listActiveStorms); unparseable timestamps are kept.
    if (!Number.isNaN(t) && t < nowMs) {
      store.storms.delete(id)
      deleteStormRow(id)
      removed++
      emit({ type: "storm_removed", at, stormId: id })
    }
  }
  return removed
}

export function getPollerStatus(): PollerStatus {
  return { ...getStore().poller }
}

export function updatePollerStatus(patch: Partial<PollerStatus>): void {
  Object.assign(getStore().poller, patch)
}
