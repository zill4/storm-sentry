// Self-tracked Tomorrow.io rate/budget manager. The free "Core" plan allows
// 3 req/sec, 25 req/hour, 500 req/day (reset midnight UTC). The API's
// X-RateLimit-* headers are keyed by opaque plan hashes and aren't cleanly
// mappable to those windows, so we count usage ourselves — this is the single
// source of truth gating every Tomorrow.io call.
//
// The daily budget is split between two consumers: `events` (the CONUS
// severe-weather sweep) and `nowcast` (per-ZIP enrichment, the unique value).

export type BudgetKind = "events" | "nowcast"

type State = {
  perSecond: number
  perHour: number
  perDay: number
  nowcastShare: number
  enabled: boolean
  sec: { start: number; count: number }
  hr: { start: number; count: number }
  dayKey: string
  dayCount: number
  kindDay: Record<BudgetKind, number>
  totalCalls: number
  totalThrottled: number
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
      nowcastShare: clamp(Number(process.env.TOMORROW_NOWCAST_SHARE ?? 0.65), 0, 1),
      enabled:
        Boolean(process.env.TOMORROW_IO_API_KEY) &&
        process.env.ENABLE_TOMORROW !== "false",
      sec: { start: now, count: 0 },
      hr: { start: now, count: 0 },
      dayKey: utcDayKey(now),
      dayCount: 0,
      kindDay: { events: 0, nowcast: 0 },
      totalCalls: 0,
      totalThrottled: 0,
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
    s.kindDay = { events: 0, nowcast: 0 }
  }
}

function allocations(s: State): Record<BudgetKind, number> {
  const nowcast = Math.floor(s.perDay * s.nowcastShare)
  return { nowcast, events: s.perDay - nowcast }
}

/** True if a call of the given kind can fire now within every rate window. */
export function canSpend(kind: BudgetKind): boolean {
  const s = getState()
  if (!s.enabled) return false
  const now = Date.now()
  roll(s, now)
  if (s.sec.count >= s.perSecond) return false
  if (s.hr.count >= s.perHour) return false
  if (s.dayCount >= s.perDay) return false
  if (s.kindDay[kind] >= allocations(s)[kind]) return false
  return true
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
}

export function noteThrottled(): void {
  getState().totalThrottled++
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
    },
    totalCalls: s.totalCalls,
    totalThrottled: s.totalThrottled,
  }
}
