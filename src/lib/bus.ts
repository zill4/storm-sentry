import type { Business, StormMatch } from "@/lib/businesses/types"
import type { StormEvent } from "@/lib/storms/types"

export type BusEvent =
  | { type: "storm_added"; at: string; storm: StormEvent }
  | { type: "storm_updated"; at: string; storm: StormEvent }
  | { type: "storm_removed"; at: string; stormId: string }
  | {
      type: "match_created"
      at: string
      match: StormMatch
      business: Business
      storm: StormEvent
    }
  | { type: "matches_pruned"; at: string; count: number }
  | { type: "fixtures_cleared"; at: string; count: number }
  | {
      type: "poll_completed"
      at: string
      summary: {
        alertsSeen: number
        accepted: number
        skippedNoGeometry: number
        expiredRemoved: number
        matchesCreated: number
      }
    }

type BusShape = {
  emitters: Set<(e: BusEvent) => void>
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryBus: BusShape | undefined
}

function getBus(): BusShape {
  if (!globalThis.__stormSentryBus) {
    globalThis.__stormSentryBus = { emitters: new Set() }
  }
  return globalThis.__stormSentryBus
}

export function emit(event: BusEvent): void {
  for (const fn of getBus().emitters) {
    try {
      fn(event)
    } catch (err) {
      console.error("[bus] emitter failed", err)
    }
  }
}

export function subscribe(fn: (e: BusEvent) => void): () => void {
  const bus = getBus()
  bus.emitters.add(fn)
  return () => {
    bus.emitters.delete(fn)
  }
}

export function subscriberCount(): number {
  return getBus().emitters.size
}
