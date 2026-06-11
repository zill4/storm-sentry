"use client"

import { useState } from "react"
import { Droplets, Search, Wind } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ForecastHour, NormalizedForecast } from "@/lib/tomorrow/types"

const CARD = "rounded-2xl border border-[#DDD8CC] bg-[#F7F5F0] shadow-sm"
const LABEL = "text-[11px] uppercase tracking-[0.08em] text-[#6F6A5F]"

type ApiOk = {
  ok: true
  cached: boolean
  stale: boolean
  zip: string
  forecast: NormalizedForecast
}

function hourLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour: "numeric" })
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" })
}
function dayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
function temp(n: number | null): string {
  return n != null ? `${Math.round(n)}°` : "—"
}
function pct(n: number | null): string {
  return n != null ? `${Math.round(n)}%` : "—"
}

export function ZipForecast() {
  const [zip, setZip] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiOk | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a 5-digit ZIP code.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forecast?zip=${zip}`, { cache: "no-store" })
      const json = await res.json()
      if (json.ok) {
        setData(json as ApiOk)
        setError(null)
      } else {
        setData(null)
        setError(json.error ?? "Could not load the forecast.")
      }
    } catch {
      setData(null)
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className={`${CARD} gap-2.5 p-5`}>
          <div className={LABEL}>ZIP code</div>
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9B958A]" />
              <input
                value={zip}
                onChange={(e) =>
                  setZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
                }
                inputMode="numeric"
                maxLength={5}
                autoFocus
                placeholder="Enter a ZIP code…"
                className="w-full rounded-lg bg-[#E7E3DA] py-2.5 pl-9 pr-3 font-mono text-sm tabular-nums text-[#201E1A] outline-none placeholder:font-sans placeholder:text-[#9B958A] focus:ring-1 focus:ring-[#201E1A]/30"
              />
            </div>
            <Button
              type="submit"
              className="shrink-0 rounded-full bg-[#201E1A] text-[#F7F5F0] hover:bg-[#201E1A]/90"
              disabled={loading || zip.length !== 5}
            >
              {loading ? "Loading…" : "Get forecast"}
            </Button>
          </form>
        </Card>

        {error && (
          <Card className="rounded-2xl border border-[#F2915C]/40 bg-[#F2915C]/15 p-4 text-sm text-[#201E1A] shadow-sm">
            {error}
          </Card>
        )}

        {data ? (
          <>
            <HourlyChartCard hours={data.forecast.hourly.slice(0, 24)} />
            <DailyOutlookCard forecast={data.forecast} />
          </>
        ) : (
          !error &&
          !loading && (
            <Card className={`${CARD} p-10 text-center text-sm text-[#9B958A]`}>
              Enter a ZIP code to see its hourly and 5-day forecast.
            </Card>
          )
        )}
      </div>

      {data && (
        <div className="flex flex-col gap-4">
          <NowCard hour={data.forecast.hourly[0] ?? null} />
          <PeakCard hours={data.forecast.hourly.slice(0, 24)} />
          <Card className={`${CARD} gap-1.5 p-5`}>
            <div className="text-sm font-semibold text-[#201E1A]">
              {data.forecast.location.name ?? `ZIP ${data.zip}`}
            </div>
            <div className="text-xs tabular-nums text-[#9B958A]">
              Updated {new Date(data.forecast.fetchedAt).toLocaleString()}
              {data.cached ? " · cached" : ""}
            </div>
            {data.stale && (
              <Badge
                variant="outline"
                className="mt-1 w-fit border-[#F2915C]/40 bg-[#F2915C]/15 text-[#201E1A]"
              >
                stale — retrying soon
              </Badge>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

// Hero "Now" card — the lime accent card for the view.
function NowCard({ hour }: { hour: ForecastHour | null }) {
  if (!hour) return null
  return (
    <Card className="gap-3 rounded-2xl border border-transparent bg-[#D9F25C] p-5 text-[#201E1A] shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#201E1A]/70">
        Now
      </div>
      <div>
        <div className="font-mono text-5xl font-semibold tabular-nums">
          {temp(hour.temperature)}
        </div>
        <div className="mt-1 text-sm text-[#201E1A]/70">
          {hour.weatherLabel ?? "—"}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-[#201E1A]/15 pt-3">
        <MetricRow
          icon={<Wind className="size-4" />}
          label="Gust"
          value={hour.windGust != null ? `${Math.round(hour.windGust)} mph` : "—"}
        />
        <MetricRow
          icon={<Droplets className="size-4" />}
          label="Precip"
          value={pct(hour.precipProbability)}
        />
      </div>
    </Card>
  )
}

// Orange accent card: worst precip odds + strongest gust in the next 24 hours.
function PeakCard({ hours }: { hours: ForecastHour[] }) {
  const maxPrecip = hours.reduce<number | null>(
    (max, h) =>
      h.precipProbability != null && (max == null || h.precipProbability > max)
        ? h.precipProbability
        : max,
    null
  )
  const maxGust = hours.reduce<number | null>(
    (max, h) =>
      h.windGust != null && (max == null || h.windGust > max) ? h.windGust : max,
    null
  )
  return (
    <Card className="gap-3 rounded-2xl border border-transparent bg-[#F2915C] p-5 text-[#201E1A] shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#201E1A]/70">
        Next 24h peak
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-3xl font-semibold tabular-nums">
            {pct(maxPrecip)}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[#201E1A]/60">
            Max precip
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-semibold tabular-nums">
            {maxGust != null ? Math.round(maxGust) : "—"}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-[#201E1A]/60">
            Max gust mph
          </div>
        </div>
      </div>
    </Card>
  )
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[#201E1A]/60">
        <span>{icon}</span>
        {label}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-[#201E1A]">
        {value}
      </div>
    </div>
  )
}

// Bar chart of plain divs: 24 hourly temps, current hour inked.
function HourlyChartCard({ hours }: { hours: ForecastHour[] }) {
  const temps = hours
    .map((h) => h.temperature)
    .filter((t): t is number => t != null)
  const min = temps.length > 0 ? Math.min(...temps) : 0
  const max = temps.length > 0 ? Math.max(...temps) : 0
  const range = max - min

  function heightPct(t: number | null): number {
    if (t == null) return 12
    if (range === 0) return 100
    return 12 + ((t - min) / range) * 88
  }

  return (
    <Card className={`${CARD} gap-0 p-0`}>
      <div className="flex items-center justify-between border-b border-[#DDD8CC] px-5 py-2.5">
        <span className="text-sm font-semibold text-[#201E1A]">
          Next 24 hours
        </span>
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[#9B958A]">
          <span className="inline-block h-2.5 w-1.5 rounded-[1px] bg-[#201E1A]" />
          now
        </span>
      </div>

      <div className="flex h-44 items-end gap-[5px] px-5 pb-2 pt-4">
        {hours.map((h, i) => (
          <div
            key={h.time}
            title={`${hourLabel(h.time)} — ${temp(h.temperature)}, ${pct(
              h.precipProbability
            )} precip`}
            className={`flex-1 rounded-t-md transition-colors ${
              i === 0 ? "bg-[#201E1A]" : "bg-[#DDD8CC] hover:bg-[#9B958A]"
            }`}
            style={{ height: `${heightPct(h.temperature)}%` }}
          />
        ))}
      </div>
      <div className="flex gap-[5px] px-5 pb-3">
        {hours.map((h, i) => (
          <div
            key={h.time}
            className="min-w-0 flex-1 truncate text-center text-[9px] tabular-nums text-[#9B958A]"
          >
            {i % 3 === 0 ? hourLabel(h.time) : ""}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[#DDD8CC] px-5 py-2.5 text-[11px]">
        <span className="text-[#6F6A5F]">
          Low{" "}
          <span className="font-mono font-semibold tabular-nums text-[#201E1A]">
            {temps.length > 0 ? `${Math.round(min)}°` : "—"}
          </span>
        </span>
        <span className="text-[#6F6A5F]">
          High{" "}
          <span className="font-mono font-semibold tabular-nums text-[#201E1A]">
            {temps.length > 0 ? `${Math.round(max)}°` : "—"}
          </span>
        </span>
      </div>
    </Card>
  )
}

// 5-day rows with a mini temp-range bar scaled to the week's min/max.
function DailyOutlookCard({ forecast }: { forecast: NormalizedForecast }) {
  const days = forecast.daily.slice(0, 6)
  const weekTemps = days
    .flatMap((d) => [d.tempMin, d.tempMax])
    .filter((t): t is number => t != null)
  const weekMin = weekTemps.length > 0 ? Math.min(...weekTemps) : 0
  const weekMax = weekTemps.length > 0 ? Math.max(...weekTemps) : 0
  const weekRange = weekMax - weekMin

  return (
    <Card className={`${CARD} gap-0 p-0`}>
      <div className="border-b border-[#DDD8CC] px-5 py-2.5 text-sm font-semibold text-[#201E1A]">
        5-day outlook
      </div>
      <div className="divide-y divide-[#DDD8CC]">
        {days.map((d) => {
          const hasRange =
            d.tempMin != null && d.tempMax != null && weekRange > 0
          const width = hasRange
            ? Math.max(((d.tempMax! - d.tempMin!) / weekRange) * 100, 6)
            : 0
          const left = hasRange
            ? Math.min(((d.tempMin! - weekMin) / weekRange) * 100, 100 - width)
            : 0
          return (
            <div
              key={d.date}
              className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-[#E7E3DA]/60"
            >
              <div className="w-24 shrink-0">
                <span className="font-medium text-[#201E1A]">
                  {dayLabel(d.date)}
                </span>{" "}
                <span className="text-xs text-[#9B958A]">{dayDate(d.date)}</span>
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-[#6F6A5F]">
                {d.weatherLabel ?? "—"}
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-[#6F6A5F]">
                {d.precipProbability ? pct(d.precipProbability) : "—"}
              </span>
              <div className="relative hidden h-1.5 w-24 shrink-0 rounded-full bg-[#E7E3DA] sm:block">
                {hasRange && (
                  <div
                    className="absolute inset-y-0 rounded-full bg-[#201E1A]"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                )}
              </div>
              <span className="w-16 shrink-0 text-right font-mono tabular-nums">
                <span className="text-[#201E1A]">{temp(d.tempMax)}</span>{" "}
                <span className="text-[#9B958A]">{temp(d.tempMin)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
