import {
  canSpend,
  noteThrottled,
  record,
  type BudgetKind,
} from "./budget"
import {
  EventsResponseSchema,
  RealtimeResponseSchema,
  type RealtimeResponse,
  type TomorrowEvent,
} from "./types"

const BASE = "https://api.tomorrow.io/v4"

/** Thrown when a call is refused locally because the budget/rate window is spent. */
export class TomorrowBudgetExceeded extends Error {
  kind: BudgetKind
  constructor(kind: BudgetKind) {
    super(`Tomorrow.io ${kind} budget exhausted for now`)
    this.name = "TomorrowBudgetExceeded"
    this.kind = kind
  }
}

/** Thrown on a missing key or a non-OK HTTP response. */
export class TomorrowClientError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "TomorrowClientError"
    this.status = status
  }
}

function apiKey(): string {
  const k = process.env.TOMORROW_IO_API_KEY
  if (!k) throw new TomorrowClientError("TOMORROW_IO_API_KEY env var is required")
  return k
}

// Every Tomorrow.io call funnels through here so budget accounting can never be
// bypassed. The budget is consumed optimistically (before the fetch) so
// concurrent callers in the same tick can't both slip past a window.
async function spend<T>(
  kind: BudgetKind,
  doFetch: () => Promise<Response>,
  parse: (json: unknown) => T,
): Promise<T> {
  if (!canSpend(kind)) throw new TomorrowBudgetExceeded(kind)
  record(kind)
  const res = await doFetch()
  if (res.status === 429) {
    noteThrottled()
    throw new TomorrowClientError("Tomorrow.io rate limited (429)", 429)
  }
  if (!res.ok) {
    throw new TomorrowClientError(`Tomorrow.io responded ${res.status}`, res.status)
  }
  return parse((await res.json()) as unknown)
}

/** Current conditions for a location (accepts "75201 US", "lat,lon", etc.). */
export function getRealtime(location: string): Promise<RealtimeResponse> {
  const url = `${BASE}/weather/realtime?location=${encodeURIComponent(location)}&units=imperial&apikey=${apiKey()}`
  return spend(
    "nowcast",
    () => fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) }),
    (json) => RealtimeResponseSchema.parse(json),
  )
}

/**
 * Severe-weather events whose footprint intersects `polygon` (a single
 * GeoJSON Polygon ring set, ≤10M km²). Returns the raw events array.
 */
export function getEvents(
  polygon: number[][][],
  insights: readonly string[],
): Promise<TomorrowEvent[]> {
  const url = `${BASE}/events?apikey=${apiKey()}`
  const body = JSON.stringify({
    location: { type: "Polygon", coordinates: polygon },
    insights,
  })
  return spend(
    "events",
    () =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
    (json) => EventsResponseSchema.parse(json).data?.events ?? [],
  )
}
