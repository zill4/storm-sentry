import { emit } from "@/lib/bus"
import { fetchActiveAlerts } from "./client"
import { normalizeNwsFeature } from "./normalize"
import {
  getPollerStatus,
  removeExpiredStorms,
  updatePollerStatus,
  upsertStorm,
} from "./store"
import { isAcceptedEventType } from "./types"

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryPollerTimer: NodeJS.Timeout | undefined
}

export async function runOnePoll(): Promise<{
  ok: boolean
  alertsSeen: number
  accepted: number
  skippedNoGeometry: number
  expiredRemoved: number
  matcher?: ReturnType<typeof import("@/lib/businesses/matcher").runMatcher> | null
  tomorrowEvents?: Awaited<
    ReturnType<typeof import("@/lib/tomorrow/events").pollTomorrowEvents>
  > | null
  zipInsights?: Awaited<
    ReturnType<typeof import("@/lib/zip-insights/pipeline").runZipInsights>
  > | null
  error?: string
}> {
  const startedAt = new Date().toISOString()
  try {
    const data = await fetchActiveAlerts()
    let accepted = 0
    let skippedNoGeometry = 0
    for (const feature of data.features) {
      const props = feature.properties
      if (!isAcceptedEventType(props.event, props.description)) continue
      const storm = normalizeNwsFeature(feature, startedAt)
      if (!storm.geometry) {
        skippedNoGeometry++
        upsertStorm(storm)
        continue
      }
      accepted++
      upsertStorm(storm)
    }

    // Optional 2nd source: Tomorrow.io severe-weather events (slow cadence,
    // budget-gated, deduped against NWS). Best-effort — never fails the poll.
    let tomorrowEvents: Awaited<
      ReturnType<typeof import("@/lib/tomorrow/events").pollTomorrowEvents>
    > | null = null
    try {
      const { pollTomorrowEvents } = await import("@/lib/tomorrow/events")
      tomorrowEvents = await pollTomorrowEvents()
    } catch (tErr) {
      console.error("[storm-poller] tomorrow events failed", tErr)
    }

    const expiredRemoved = removeExpiredStorms()
    let matcherResult: ReturnType<typeof import("@/lib/businesses/matcher").runMatcher> | null = null
    try {
      const { runMatcher } = await import("@/lib/businesses/matcher")
      matcherResult = runMatcher()
    } catch (matchErr) {
      console.error("[storm-poller] matcher failed", matchErr)
    }

    // ZIP-level intersection + nowcast enrichment. Runs off NWS storms even when
    // Tomorrow.io is disabled (enrichment simply no-ops without budget).
    let zipInsights: Awaited<
      ReturnType<typeof import("@/lib/zip-insights/pipeline").runZipInsights>
    > | null = null
    try {
      const { runZipInsights } = await import("@/lib/zip-insights/pipeline")
      zipInsights = await runZipInsights()
    } catch (zErr) {
      console.error("[storm-poller] zip insights failed", zErr)
    }
    const status = getPollerStatus()
    updatePollerStatus({
      lastPollAt: startedAt,
      lastPollOk: true,
      lastPollError: null,
      totalPolls: status.totalPolls + 1,
      totalAlertsSeen: status.totalAlertsSeen + data.features.length,
      totalAcceptedAlerts: status.totalAcceptedAlerts + accepted,
      totalSkippedNoGeometry: status.totalSkippedNoGeometry + skippedNoGeometry,
    })
    emit({
      type: "poll_completed",
      at: startedAt,
      summary: {
        alertsSeen: data.features.length,
        accepted,
        skippedNoGeometry,
        expiredRemoved,
        matchesCreated: matcherResult?.matchesCreated ?? 0,
        zipInsightsCreated: zipInsights?.created ?? 0,
        threatenedZips: zipInsights?.threatenedZips ?? 0,
        tomorrowEventsIngested: tomorrowEvents?.ingested ?? 0,
      },
    })
    return {
      ok: true,
      alertsSeen: data.features.length,
      accepted,
      skippedNoGeometry,
      expiredRemoved,
      matcher: matcherResult,
      tomorrowEvents,
      zipInsights,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = getPollerStatus()
    updatePollerStatus({
      lastPollAt: startedAt,
      lastPollOk: false,
      lastPollError: message,
      totalPolls: status.totalPolls + 1,
    })
    return {
      ok: false,
      alertsSeen: 0,
      accepted: 0,
      skippedNoGeometry: 0,
      expiredRemoved: 0,
      error: message,
    }
  }
}

export function startPoller(): { started: boolean; reason?: string } {
  if (globalThis.__stormSentryPollerTimer) {
    return { started: false, reason: "already running" }
  }
  const status = getPollerStatus()
  if (!status.enabled) {
    return { started: false, reason: "disabled by ENABLE_NWS_POLLER" }
  }
  const intervalMs = Math.max(30, status.pollIntervalSeconds) * 1000
  updatePollerStatus({ startedAt: new Date().toISOString() })

  const tick = async () => {
    try {
      // Dynamic import so dev HMR picks up filter / normalize / store changes between ticks.
      const mod = await import("./poller")
      await mod.runOnePoll()
    } catch (err) {
      console.error("[storm-poller] tick failed", err)
    }
  }

  void tick()
  globalThis.__stormSentryPollerTimer = setInterval(tick, intervalMs)
  return { started: true }
}

export function stopPoller(): boolean {
  if (!globalThis.__stormSentryPollerTimer) return false
  clearInterval(globalThis.__stormSentryPollerTimer)
  globalThis.__stormSentryPollerTimer = undefined
  return true
}
