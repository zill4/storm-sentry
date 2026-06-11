// Self-tracked Tomorrow.io rate/budget manager. The free "Core" plan allows
// 3 req/sec, 25 req/hour, 500 req/day (reset midnight UTC). The API's
// X-RateLimit-* headers are keyed by opaque plan hashes and aren't cleanly
// mappable to those windows, so we count usage ourselves — this is the single
// source of truth gating every Tomorrow.io call.
//
// The daily budget is split between two consumers: `events` (the CONUS
// severe-weather sweep) and `nowcast` (per-ZIP enrichment, the unique value).

export type BudgetKind = "events" | "nowcast" | "forecast"

type State = {
  perSecond: number
  perHour: number
  perDay: number
  nowcastShare: number
  forecastShare: number
  enabled: boolean
  sec: { start: number; count: number }
  hr: { start: number; count: number }
  dayKey: string
  dayCount: number
  kindDay: Record<BudgetKind, number>
  totalCalls: number
  totalThrottled: number
  cooldownUntil: number
  lastBackgroundCallAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryTomorrowBudget: State | undefined
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function utcDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

function getState(): State {
  if (!globalThis.__stormSentryTomorrowBudget) {
    const now = Date.now()
    globalThis.__stormSentryTomorrowBudget = {
      perSecond: Number(process.env.TOMORROW_PER_SECOND ?? 3),
      perHour: Number(process.env.TOMORROW_PER_HOUR ?? 25),
      perDay: Number(process.env.TOMORROW_DAILY_BUDGET ?? 480),
      nowcastShare: clamp(Number(process.env.TOMORROW_NOWCAST_SHARE ?? 0.55), 0, 1),
      forecastShare: clamp(Number(process.env.TOMORROW_FORECAST_SHARE ?? 0.25), 0, 1),
      enabled:
        Boolean(process.env.TOMORROW_IO_API_KEY) &&
        process.env.ENABLE_TOMORROW !== "false",
      sec: { start: now, count: 0 },
      hr: { start: now, count: 0 },
      dayKey: utcDayKey(now),
      dayCount: 0,
      kindDay: { events: 0, nowcast: 0, forecast: 0 },
      totalCalls: 0,
      totalThrottled: 0,
      cooldownUntil: 0,
      lastBackgroundCallAt: 0,
    }
  }
  return globalThis.__stormSentryTomorrowBudget
}

function roll(s: State, now: number): void {
  if (now - s.sec.start >= 1000) {
    s.sec.start = now
    s.sec.count = 0
  }
  if (now - s.hr.start >= 3_600_000) {
    s.hr.start = now
    s.hr.count = 0
  }
  const dk = utcDayKey(now)
  if (dk !== s.dayKey) {
    s.dayKey = dk
    s.dayCount = 0
    s.kindDay = { events: 0, nowcast: 0, forecast: 0 }
  }
}

function allocations(s: State): Record<BudgetKind, number> {
  const nowcast = Math.floor(s.perDay * s.nowcastShare)
  const forecast = Math.floor(s.perDay * s.forecastShare)
  const events = Math.max(0, s.perDay - nowcast - forecast)
  return { nowcast, forecast, events }
}

export type BudgetBlock =
  | "second"
  | "hour"
  | "day"
  | "kind"
  | "cooldown"
  | "spacing"
  | "disabled"
  | null

/** Why a call of `kind` can't fire right now (or null if it can). */
export function budgetBlockReason(kind: BudgetKind): BudgetBlock {
  if (process.env.TOMORROW_OFFLINE === "true") return "disabled"
  const s = getState()
  if (!s.enabled) return "disabled"
  if (Date.now() < s.cooldownUntil) return "cooldown"
  roll(s, Date.now())
  if (s.sec.count >= s.perSecond) return "second"
  if (s.hr.count >= s.perHour) return "hour"
  if (s.dayCount >= s.perDay) return "day"
  if (s.kindDay[kind] >= allocations(s)[kind]) return "kind"
  // Background calls (the storm poller) are spaced out so they sip the budget
  // and leave headroom; forecast (on-demand + cached) is exempt.
  if (kind !== "forecast") {
    const minMs = Number(process.env.TOMORROW_MIN_CALL_INTERVAL_SEC ?? 0) * 1000
    if (minMs > 0 && Date.now() - s.lastBackgroundCallAt < minMs) return "spacing"
  }
  return null
}

/** True if a call of the given kind can fire now within every rate window. */
export function canSpend(kind: BudgetKind): boolean {
  return budgetBlockReason(kind) === null
}

/** Record that a call of the given kind fired. Call right before the fetch. */
export function record(kind: BudgetKind): void {
  const s = getState()
  roll(s, Date.now())
  s.sec.count++
  s.hr.count++
  s.dayCount++
  s.kindDay[kind]++
  s.totalCalls++
  if (kind !== "forecast") s.lastBackgroundCallAt = Date.now()
  mirrorToDb(s)
}

// Write-through so a restart/redeploy resumes today's spend instead of
// resetting to zero against the same upstream key.
function mirrorToDb(s: State): void {
  void import("@/lib/db/persist").then((m) =>
    m.persistBudgetCounters({
      dayKey: s.dayKey,
      dayCount: s.dayCount,
      kindDay: { ...s.kindDay },
      hourWindowStart: s.hr.start,
      hourCount: s.hr.count,
      totalCalls: s.totalCalls,
      totalThrottled: s.totalThrottled,
    }),
  )
}

/** Boot-time restore of today's counters from Postgres. */
export function seedBudget(seed: {
  dayKey: string
  dayCount: number
  kindDay: Record<BudgetKind, number>
  hourWindowStart: number
  hourCount: number
  totalCalls: number
  totalThrottled: number
}): void {
  const s = getState()
  if (seed.dayKey !== s.dayKey) return // stale row from a previous UTC day
  s.dayCount = Math.max(s.dayCount, seed.dayCount)
  for (const k of Object.keys(s.kindDay) as BudgetKind[]) {
    s.kindDay[k] = Math.max(s.kindDay[k], seed.kindDay[k] ?? 0)
  }
  // Resume the persisted hour window only if it's still current.
  if (Date.now() - seed.hourWindowStart < 3_600_000) {
    s.hr.start = seed.hourWindowStart
    s.hr.count = Math.max(s.hr.count, seed.hourCount)
  }
  s.totalCalls = Math.max(s.totalCalls, seed.totalCalls)
  s.totalThrottled = Math.max(s.totalThrottled, seed.totalThrottled)
}

// A 429 means the shared key's rate window is already spent — so stop calling
// entirely for a cooldown instead of burning the rest of our local budget on
// calls that are guaranteed to 429 too.
export function noteThrottled(): void {
  const s = getState()
  s.totalThrottled++
  s.cooldownUntil =
    Date.now() + Number(process.env.TOMORROW_COOLDOWN_SEC ?? 120) * 1000
  mirrorToDb(s)
}

export function isEnabled(): boolean {
  return getState().enabled
}

export type BudgetStatus = {
  enabled: boolean
  limits: { perSecond: number; perHour: number; perDay: number }
  dayKey: string
  used: { second: number; hour: number; day: number }
  remaining: { hour: number; day: number }
  byKind: Record<BudgetKind, { allocation: number; usedToday: number; remaining: number }>
  totalCalls: number
  totalThrottled: number
  cooldownActive: boolean
  cooldownSecondsLeft: number
}

export function budgetStatus(): BudgetStatus {
  const s = getState()
  roll(s, Date.now())
  const alloc = allocations(s)
  return {
    enabled: s.enabled,
    limits: { perSecond: s.perSecond, perHour: s.perHour, perDay: s.perDay },
    dayKey: s.dayKey,
    used: { second: s.sec.count, hour: s.hr.count, day: s.dayCount },
    remaining: {
      hour: Math.max(0, s.perHour - s.hr.count),
      day: Math.max(0, s.perDay - s.dayCount),
    },
    byKind: {
      events: {
        allocation: alloc.events,
        usedToday: s.kindDay.events,
        remaining: Math.max(0, alloc.events - s.kindDay.events),
      },
      nowcast: {
        allocation: alloc.nowcast,
        usedToday: s.kindDay.nowcast,
        remaining: Math.max(0, alloc.nowcast - s.kindDay.nowcast),
      },
      forecast: {
        allocation: alloc.forecast,
        usedToday: s.kindDay.forecast,
        remaining: Math.max(0, alloc.forecast - s.kindDay.forecast),
      },
    },
    totalCalls: s.totalCalls,
    totalThrottled: s.totalThrottled,
    cooldownActive: Date.now() < s.cooldownUntil,
    cooldownSecondsLeft: Math.max(0, Math.ceil((s.cooldownUntil - Date.now()) / 1000)),
  }
}
