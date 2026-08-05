import type { Business, StormMatch } from "@/lib/businesses/types"
import type { StormEvent } from "@/lib/storms/types"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"

export type BusEvent =
  | { type: "storm_added"; at: string; storm: StormEvent }
  | { type: "storm_updated"; at: string; storm: StormEvent }
  | { type: "storm_removed"; at: string; stormId: string }
  | { type: "zip_insight_added"; at: string; insight: ZipInsightEvent }
  | { type: "zip_insight_updated"; at: string; insight: ZipInsightEvent }
  // Emitted by the per-ZIP alert gate (severity + cooldown passed). This — NOT
  // the raw zip_insight_* events — is what the outbound channels (webhook, GHL)
  // consume, so both are filtered identically server-side.
  | { type: "zip_alert"; at: string; insight: ZipInsightEvent }
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
        zipInsightsCreated?: number
        threatenedZips?: number
        tomorrowEventsIngested?: number
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
