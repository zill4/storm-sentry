"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapPin, RefreshCw, Radar } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StormMap } from "@/components/storm-map"
import { useLiveEvents } from "@/lib/use-live-events"
import { severityHex } from "@/lib/storms/severity"
import { severityRank, type StormEvent } from "@/lib/storms/types"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"

type Props = {
  initialStorms: StormEvent[]
  refreshIntervalMs?: number
}

const CARD = "rounded-2xl border border-[#DDD8CC] bg-[#F7F5F0] shadow-sm"

export function StormWatch({ initialStorms, refreshIntervalMs = 60000 }: Props) {
  const [storms, setStorms] = useState<StormEvent[]>(initialStorms)
  const [zipInsights, setZipInsights] = useState<ZipInsightEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [live, setLive] = useState(false)
  const [showRadar, setShowRadar] = useState(true)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  async function refresh() {
    setRefreshing(true)
    try {
      const [stormsRes, zipsRes] = await Promise.all([
        fetch("/api/storms", { cache: "no-store" }),
        fetch("/api/zip-insights?limit=1500", { cache: "no-store" }),
      ])
      if (stormsRes.ok) {
        const data = (await stormsRes.json()) as { storms: StormEvent[] }
        setStorms(data.storms)
      }
      if (zipsRes.ok) {
        const data = (await zipsRes.json()) as { events: ZipInsightEvent[] }
        setZipInsights(data.events)
      }
      setLastRefresh(new Date())
    } finally {
      setRefreshing(false)
    }
  }

  function debouncedRefresh() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void refresh()
    }, 250)
  }

  useLiveEvents((event) => {
    if (event.type === "hello") {
      setLive(true)
      return
    }
    debouncedRefresh()
  })

  // Pull storms + the ZIP-insight queue on mount, then on an interval.
  // refresh() sets lastRefresh on completion; starting at null is hydration-safe.
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const id = setInterval(() => void refresh(), refreshIntervalMs)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshIntervalMs])

  const stats = useMemo(() => {
    const severe = storms.filter((s) => severityRank(s.severity) >= 3).length
    const distinctZips = new Set(zipInsights.map((z) => z.zip)).size
    const enriched = zipInsights.filter((z) => z.nowcast != null).length
    return { total: storms.length, severe, distinctZips, enriched }
  }, [storms, zipInsights])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active Alerts" value={stats.total} />
        <StatCard label="Severe & Above" value={stats.severe} tone="orange" />
        <StatCard
          label="Threatened ZIPs"
          value={stats.distinctZips}
          tone="lime"
          sub={stats.enriched > 0 ? `${stats.enriched} nowcast-enriched` : undefined}
        />
        <Card className={`${CARD} justify-between gap-2 py-4`}>
          <div className="px-4 text-[11px] uppercase tracking-[0.08em] text-[#6F6A5F]">
            Feed
          </div>
          <div className="flex items-center gap-2 px-4">
            <span className="relative flex size-2.5">
              {live && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#7BA05B] opacity-75" />
              )}
              <span
                className={`relative inline-flex size-2.5 rounded-full ${
                  live ? "bg-[#7BA05B]" : "bg-[#9B958A]"
                }`}
              />
            </span>
            <span className="text-sm font-semibold text-[#201E1A]">
              {live ? "Live" : "Offline"}
            </span>
          </div>
          <div className="px-4 text-xs text-[#9B958A]">
            Updated {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className={`${CARD} gap-0 overflow-hidden p-0 lg:col-span-2`}>
          <div className="flex items-center justify-between border-b border-[#DDD8CC] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#201E1A]">
              <Radar className="size-4 text-[#6F6A5F]" />
              Live Map
            </div>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#6F6A5F]">
                Radar
                <Switch
                  checked={showRadar}
                  onCheckedChange={(c) => setShowRadar(c)}
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-[#DDD8CC] bg-transparent text-[#201E1A] hover:bg-[#E7E3DA]"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={refreshing ? "animate-spin" : undefined} />
                Refresh
              </Button>
            </div>
          </div>
          <div className="h-[480px] lg:h-[560px]">
            <StormMap
              storms={storms}
              zipInsights={zipInsights}
              selectedId={selectedId}
              onSelect={setSelectedId}
              showRadar={showRadar}
            />
          </div>
        </Card>

        <Card className={`${CARD} flex h-[560px] flex-col gap-0 p-0`}>
          <Tabs defaultValue="storms" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="border-b border-[#DDD8CC] px-3 py-2.5">
              <TabsList variant="line" className="h-8">
                <TabsTrigger
                  value="storms"
                  className="text-[#6F6A5F] hover:text-[#201E1A] data-active:text-[#201E1A] after:bg-[#201E1A]"
                >
                  Storms ({storms.length})
                </TabsTrigger>
                <TabsTrigger
                  value="zips"
                  className="text-[#6F6A5F] hover:text-[#201E1A] data-active:text-[#201E1A] after:bg-[#201E1A]"
                >
                  ZIPs ({stats.distinctZips})
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="storms" className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <ActiveStormsList
                  storms={storms}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            </TabsContent>
            <TabsContent value="zips" className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <ZipInsightsList insights={zipInsights} />
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
  sub,
}: {
  label: string
  value: number
  tone?: "lime" | "orange"
  sub?: string
}) {
  const surface =
    tone === "lime"
      ? "rounded-2xl border border-transparent bg-[#D9F25C] shadow-sm"
      : tone === "orange"
        ? "rounded-2xl border border-transparent bg-[#F2915C] shadow-sm"
        : CARD
  return (
    <Card className={`${surface} gap-2 py-4 text-[#201E1A]`}>
      <div
        className={`px-4 text-[11px] uppercase tracking-[0.08em] ${
          tone ? "text-[#201E1A]/70" : "text-[#6F6A5F]"
        }`}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-2 px-4">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {value}
        </span>
      </div>
      {sub && (
        <div
          className={`px-4 text-[11px] ${
            tone ? "text-[#201E1A]/60" : "text-[#9B958A]"
          }`}
        >
          {sub}
        </div>
      )}
    </Card>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function ActiveStormsList({
  storms,
  selectedId,
  onSelect,
}: {
  storms: StormEvent[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const sorted = useMemo(() => {
    return [...storms].sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity)
      if (sev !== 0) return sev
      return (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
    })
  }, [storms])

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#9B958A]">
        No active alerts right now. The feed refreshes automatically.
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {sorted.map((s) => {
        const selected = s.id === selectedId
        const color = severityHex(s.severity)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(selected ? null : s.id)}
            className={`w-full rounded-lg border p-3 text-left transition ${
              selected
                ? "border-[#201E1A]/25 bg-[#E7E3DA]"
                : "border-[#DDD8CC] bg-[#F7F5F0] hover:bg-[#E7E3DA]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-[#201E1A]">
                {s.eventType}
              </span>
              <Badge
                variant="outline"
                className="shrink-0 border-transparent text-[10px] font-semibold uppercase tracking-wide"
                style={{ color, backgroundColor: `${color}22` }}
              >
                {s.severity}
              </Badge>
            </div>
            {s.areaDesc && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-[#6F6A5F]">
                <MapPin className="mt-0.5 size-3 shrink-0 text-[#9B958A]" />
                <span className="line-clamp-2">{s.areaDesc}</span>
              </div>
            )}
            <div className="mt-1.5 text-[11px] tabular-nums text-[#9B958A]">
              {formatTime(s.startedAt)}
              {s.expiresAt ? ` → ${formatTime(s.expiresAt)}` : ""}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ZipInsightsList({ insights }: { insights: ZipInsightEvent[] }) {
  const sorted = useMemo(() => {
    return [...insights]
      .sort((a, b) => {
        const sev = severityRank(b.severity) - severityRank(a.severity)
        if (sev !== 0) return sev
        return a.distanceMeters - b.distanceMeters
      })
      .slice(0, 250)
  }, [insights])

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#9B958A]">
        No ZIP codes under active storms. Threatened ZIPs appear here as storms
        move in.
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {sorted.map((z) => {
        const color = severityHex(z.severity)
        const miles = (z.distanceMeters / 1609.344).toFixed(1)
        const n = z.nowcast
        return (
          <div
            key={z.id}
            className="rounded-lg border border-[#DDD8CC] bg-[#F7F5F0] p-3 hover:bg-[#E7E3DA]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums text-[#201E1A]">
                {z.zip}
              </span>
              <Badge
                variant="outline"
                className="shrink-0 border-transparent text-[10px] font-semibold uppercase tracking-wide"
                style={{ color, backgroundColor: `${color}22` }}
              >
                {z.severity}
              </Badge>
            </div>
            <div className="mt-1 truncate text-xs text-[#6F6A5F]">
              {z.eventType}
              <span className="text-[#9B958A]"> · {miles} mi from center</span>
            </div>
            {n ? (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-[#6F6A5F]">
                {n.windGust != null && <span>{Math.round(n.windGust)} mph gust</span>}
                {n.precipIntensity != null && (
                  <span>{n.precipIntensity.toFixed(2)} in/hr</span>
                )}
                {n.weatherLabel && (
                  <span className="text-[#9B958A]">{n.weatherLabel}</span>
                )}
              </div>
            ) : (
              <div className="mt-1.5 text-[11px] text-[#9B958A]">
                Queued · nowcast pending
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
