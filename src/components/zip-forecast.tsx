"use client"

import { useState } from "react"
import { Droplets, Search, Wind } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { NormalizedForecast } from "@/lib/tomorrow/types"

const CARD = "rounded-2xl border border-[#DDD8CC] bg-[#F7F5F0] shadow-sm"

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
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9B958A]" />
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            inputMode="numeric"
            maxLength={5}
            placeholder="Enter a ZIP code…"
            className="w-full rounded-lg border border-[#DDD8CC] bg-[#F7F5F0] py-2 pl-9 pr-3 text-sm text-[#201E1A] outline-none placeholder:text-[#9B958A] focus:border-[#201E1A]/40"
          />
        </div>
        <Button
          type="submit"
          className="rounded-full bg-[#201E1A] text-[#F7F5F0] hover:bg-[#201E1A]/90"
          disabled={loading || zip.length !== 5}
        >
          {loading ? "Loading…" : "Get forecast"}
        </Button>
      </form>

      {error && (
        <Card className="rounded-2xl border border-[#F2915C]/40 bg-[#F2915C]/15 p-4 text-sm text-[#201E1A] shadow-sm">
          {error}
        </Card>
      )}

      {data && <ForecastView data={data} />}

      {!data && !error && !loading && (
        <Card className={`${CARD} p-10 text-center text-sm text-[#9B958A]`}>
          Enter a ZIP code to see its hourly and 5-day forecast.
        </Card>
      )}
    </div>
  )
}

function ForecastView({ data }: { data: ApiOk }) {
  const f = data.forecast
  const now = f.hourly[0]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-[#201E1A]">
            {f.location.name ?? `ZIP ${data.zip}`}
          </div>
          <div className="text-xs text-[#9B958A]">
            Updated {new Date(f.fetchedAt).toLocaleString()}
            {data.cached ? " · cached" : ""}
          </div>
        </div>
        {data.stale && (
          <Badge variant="outline" className="border-[#F2915C]/40 bg-[#F2915C]/15 text-[#201E1A]">
            stale — retrying soon
          </Badge>
        )}
      </div>

      {now && (
        <Card className="flex items-center justify-between rounded-2xl border border-transparent bg-[#D9F25C] p-5 text-[#201E1A] shadow-sm">
          <div>
            <div className="font-mono text-4xl font-semibold tabular-nums">
              {temp(now.temperature)}
            </div>
            <div className="mt-0.5 text-sm text-[#201E1A]/70">{now.weatherLabel ?? "—"}</div>
          </div>
          <div className="flex gap-6">
            <Metric icon={<Wind className="size-4" />} label="Gust" value={now.windGust != null ? `${Math.round(now.windGust)} mph` : "—"} />
            <Metric icon={<Droplets className="size-4" />} label="Precip" value={pct(now.precipProbability)} />
          </div>
        </Card>
      )}

      <Card className={`${CARD} gap-0 p-0`}>
        <div className="border-b border-[#DDD8CC] px-4 py-2.5 text-sm font-semibold text-[#201E1A]">
          Next 24 hours
        </div>
        <div className="flex gap-1 overflow-x-auto p-3">
          {f.hourly.slice(0, 24).map((h) => (
            <div
              key={h.time}
              className="flex min-w-[58px] flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-center"
            >
              <span className="text-[11px] text-[#9B958A]">{hourLabel(h.time)}</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#201E1A]">
                {temp(h.temperature)}
              </span>
              <span className="text-[10px] tabular-nums text-[#6F6A5F]">
                {h.precipProbability ? pct(h.precipProbability) : ""}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className={`${CARD} gap-0 p-0`}>
        <div className="border-b border-[#DDD8CC] px-4 py-2.5 text-sm font-semibold text-[#201E1A]">
          5-day outlook
        </div>
        <div className="divide-y divide-[#DDD8CC]">
          {f.daily.slice(0, 6).map((d) => (
            <div key={d.date} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <div className="w-24 shrink-0">
                <span className="font-medium text-[#201E1A]">{dayLabel(d.date)}</span>{" "}
                <span className="text-[#9B958A]">{dayDate(d.date)}</span>
              </div>
              <span className="min-w-0 flex-1 truncate text-xs text-[#6F6A5F]">
                {d.weatherLabel ?? "—"}
              </span>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[#6F6A5F]">
                {d.precipProbability ? pct(d.precipProbability) : "—"}
              </span>
              <span className="w-16 shrink-0 text-right font-mono tabular-nums">
                <span className="text-[#201E1A]">{temp(d.tempMax)}</span>{" "}
                <span className="text-[#9B958A]">{temp(d.tempMin)}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[#201E1A]/60">
        <span>{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#201E1A]">{value}</div>
    </div>
  )
}
