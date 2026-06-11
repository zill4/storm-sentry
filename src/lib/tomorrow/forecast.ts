import { eq } from "drizzle-orm"

import { getDb, isDbConfigured } from "@/lib/db/client"
import { forecastCache } from "@/lib/db/schema"
import { budgetBlockReason } from "./budget"
import { getForecast, TomorrowBudgetExceeded, TomorrowClientError } from "./client"
import { FORECAST_FIXTURE } from "./fixtures/forecast-sample"
import {
  ForecastResponseSchema,
  weatherLabel,
  type ForecastResponse,
  type NormalizedForecast,
} from "./types"

// On-demand per-ZIP forecast with a shared TTL cache, so repeated lookups of the
// same ZIP never re-hit the API. Cache is DB-backed when DATABASE_URL is set
// (shared across replicas, survives restarts) and falls back to in-memory
// otherwise — both protect the budget identically for a single instance.

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryForecastCache:
    | Map<string, { payload: NormalizedForecast; at: number }>
    | undefined
}

function memCache(): Map<string, { payload: NormalizedForecast; at: number }> {
  if (!globalThis.__stormSentryForecastCache) {
    globalThis.__stormSentryForecastCache = new Map()
  }
  return globalThis.__stormSentryForecastCache
}

function ttlMs(): number {
  return Number(process.env.FORECAST_CACHE_TTL_MIN ?? 60) * 60_000
}

async function readCache(
  zip: string,
): Promise<{ payload: NormalizedForecast; at: number } | null> {
  if (isDbConfigured()) {
    const rows = await getDb()
      .select()
      .from(forecastCache)
      .where(eq(forecastCache.zip, zip))
      .limit(1)
    const row = rows[0]
    return row ? { payload: row.payload, at: new Date(row.fetchedAt).getTime() } : null
  }
  return memCache().get(zip) ?? null
}

async function writeCache(zip: string, payload: NormalizedForecast): Promise<void> {
  if (isDbConfigured()) {
    const fetchedAt = new Date()
    await getDb()
      .insert(forecastCache)
      .values({ zip, payload, fetchedAt })
      .onConflictDoUpdate({ target: forecastCache.zip, set: { payload, fetchedAt } })
    return
  }
  memCache().set(zip, { payload, at: Date.now() })
}

function firstNumber(...vals: (number | null | undefined)[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && !Number.isNaN(v)) return v
  }
  return null
}

function normalizeForecast(raw: ForecastResponse, zip: string): NormalizedForecast {
  const hourly = (raw.timelines.hourly ?? []).map((e) => {
    const v = e.values
    const precip = Math.max(
      v.rainIntensity ?? 0,
      v.sleetIntensity ?? 0,
      v.snowIntensity ?? 0,
      v.freezingRainIntensity ?? 0,
    )
    const code = firstNumber(v.weatherCode)
    return {
      time: e.time,
      temperature: firstNumber(v.temperature),
      precipProbability: firstNumber(v.precipitationProbability),
      precipIntensity: Number(precip.toFixed(3)),
      windGust: firstNumber(v.windGust),
      weatherCode: code,
      weatherLabel: weatherLabel(code),
    }
  })

  const daily = (raw.timelines.daily ?? []).map((e) => {
    const v = e.values
    const code = firstNumber(v.weatherCodeMax, v.weatherCode, v.weatherCodeMin)
    return {
      date: e.time,
      tempMin: firstNumber(v.temperatureMin, v.temperature),
      tempMax: firstNumber(v.temperatureMax, v.temperature),
      precipProbability: firstNumber(
        v.precipitationProbabilityMax,
        v.precipitationProbabilityAvg,
        v.precipitationProbability,
      ),
      windGust: firstNumber(v.windGustMax, v.windGust, v.windGustAvg),
      weatherCode: code,
      weatherLabel: weatherLabel(code),
    }
  })

  return {
    zip,
    location: {
      name: raw.location?.name ?? null,
      lat: raw.location?.lat ?? null,
      lon: raw.location?.lon ?? null,
    },
    hourly,
    daily,
    fetchedAt: new Date().toISOString(),
  }
}

export type ForecastLookup =
  | { ok: true; forecast: NormalizedForecast; cached: boolean; stale: boolean }
  | { ok: false; error: string; retryable: boolean }

/**
 * Forecast for a ZIP: serve a fresh cache hit, else spend one budgeted API call.
 * On a rate-limit/budget miss, serve a stale cached forecast if we have one
 * rather than failing — that's the whole point of the cache layer.
 */
export async function getZipForecast(zip: string): Promise<ForecastLookup> {
  // Offline build mode: serve the captured real-shaped fixture, zero API calls.
  if (process.env.TOMORROW_OFFLINE === "true") {
    const raw = ForecastResponseSchema.parse(FORECAST_FIXTURE)
    return { ok: true, forecast: normalizeForecast(raw, zip), cached: false, stale: false }
  }

  const cached = await readCache(zip)
  if (cached && Date.now() - cached.at <= ttlMs()) {
    return { ok: true, forecast: cached.payload, cached: true, stale: false }
  }

  const block = budgetBlockReason("forecast")
  if (block === null) {
    try {
      const raw = await getForecast(`${zip} US`)
      const normalized = normalizeForecast(raw, zip)
      await writeCache(zip, normalized)
      return { ok: true, forecast: normalized, cached: false, stale: false }
    } catch (err) {
      if (cached) return { ok: true, forecast: cached.payload, cached: true, stale: true }
      const rateLimited =
        err instanceof TomorrowBudgetExceeded ||
        (err instanceof TomorrowClientError && err.status === 429)
      return {
        ok: false,
        error: rateLimited
          ? "Forecast service is busy right now — please try again in a minute."
          : "Could not load the forecast for this ZIP.",
        retryable: true,
      }
    }
  }

  // Blocked before calling out — report the limit that actually tripped.
  if (cached) return { ok: true, forecast: cached.payload, cached: true, stale: true }
  const dailyExhausted = block === "day" || block === "kind"
  return {
    ok: false,
    error: dailyExhausted
      ? "Forecast unavailable — the daily Tomorrow.io budget is spent (resets 00:00 UTC)."
      : "Forecast temporarily unavailable — Tomorrow.io rate limit reached. Try again in a minute.",
    retryable: true,
  }
}
