import { getRealtime, TomorrowBudgetExceeded } from "./client"
import { weatherLabel, type NowcastValues } from "./types"

// Per-ZIP quantitative nowcast from Tomorrow.io Realtime. Cached per ZIP with a
// TTL so a ZIP under a long-lived storm isn't re-fetched every poll cycle —
// this is what keeps the scarce daily budget from draining.

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryNowcastCache:
    | Map<string, { values: NowcastValues; at: number }>
    | undefined
  // eslint-disable-next-line no-var
  var __stormSentryNowcastFailures: Map<string, number> | undefined
}

// Negative cache: a ZIP whose enrichment just failed (429/500) is skipped for a
// while instead of being retried every poll cycle — otherwise a handful of
// failing ZIPs can burn the entire budget making zero progress.
function failures(): Map<string, number> {
  if (!globalThis.__stormSentryNowcastFailures) {
    globalThis.__stormSentryNowcastFailures = new Map()
  }
  return globalThis.__stormSentryNowcastFailures
}

function failTtlMs(): number {
  return Number(process.env.TOMORROW_NOWCAST_FAIL_TTL_MIN ?? 10) * 60_000
}

function cache(): Map<string, { values: NowcastValues; at: number }> {
  if (!globalThis.__stormSentryNowcastCache) {
    globalThis.__stormSentryNowcastCache = new Map()
  }
  return globalThis.__stormSentryNowcastCache
}

function ttlMs(): number {
  return Number(process.env.TOMORROW_NOWCAST_TTL_MIN ?? 20) * 60_000
}

/** Fresh cached nowcast for a ZIP, or null if absent/stale. No API call. */
export function getCachedNowcast(zip: string): NowcastValues | null {
  const hit = cache().get(zip)
  if (!hit) return null
  if (Date.now() - hit.at > ttlMs()) return null
  return hit.values
}

export type EnrichResult = {
  values: NowcastValues | null
  cached: boolean
  /** True only when a live API call was actually made. */
  spent: boolean
}

/** Return cached nowcast if fresh, else spend one Realtime call to fetch it. */
export async function enrichZip(zip: string): Promise<EnrichResult> {
  const cached = getCachedNowcast(zip)
  if (cached) return { values: cached, cached: true, spent: false }

  const failedAt = failures().get(zip)
  if (failedAt && Date.now() - failedAt < failTtlMs()) {
    return { values: null, cached: false, spent: false }
  }

  try {
    const res = await getRealtime(`${zip} US`)
    const v = res.data.values
    const precipIntensity = Math.max(
      v.rainIntensity ?? 0,
      v.sleetIntensity ?? 0,
      v.snowIntensity ?? 0,
      v.freezingRainIntensity ?? 0,
    )
    const values: NowcastValues = {
      precipIntensity: Number(precipIntensity.toFixed(3)),
      precipProbability: v.precipitationProbability ?? null,
      windGust: v.windGust ?? null,
      windSpeed: v.windSpeed ?? null,
      temperature: v.temperature ?? null,
      weatherCode: v.weatherCode ?? null,
      weatherLabel: weatherLabel(v.weatherCode),
      fetchedAt: new Date().toISOString(),
    }
    cache().set(zip, { values, at: Date.now() })
    failures().delete(zip)
    return { values, cached: false, spent: true }
  } catch (err) {
    failures().set(zip, Date.now())
    // Budget exhaustion is expected back-pressure, not an error worth logging.
    if (!(err instanceof TomorrowBudgetExceeded)) {
      console.error(`[nowcast] enrich ${zip} failed`, err)
    }
    return { values: null, cached: false, spent: false }
  }
}
