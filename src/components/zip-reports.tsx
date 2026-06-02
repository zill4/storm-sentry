"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  Clock,
  CloudRain,
  ExternalLink,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  Thermometer,
  TriangleAlert,
  Wind,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLiveEvents } from "@/lib/use-live-events"
import { severityHex } from "@/lib/storms/severity"
import { severityRank, type StormEvent } from "@/lib/storms/types"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"

const GLASS = "border-0 bg-white/[0.03] ring-1 ring-white/10 backdrop-blur"

type SevFilter = "all" | "moderate" | "severe" | "extreme"
const SEV_FILTERS: { key: SevFilter; label: string; minRank: number }[] = [
  { key: "all", label: "All", minRank: 0 },
  { key: "moderate", label: "Moderate+", minRank: 2 },
  { key: "severe", label: "Severe+", minRank: 3 },
  { key: "extreme", label: "Extreme", minRank: 4 },
]

const SOURCE_LABEL: Record<StormEvent["source"], string> = {
  nws: "NWS",
  tomorrow: "Tomorrow.io",
  fixture: "Fixture",
}

function formatTime(iso: string | null | undefined): string {
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

export function ZipReports() {
  const [insights, setInsights] = useState<ZipInsightEvent[]>([])
  const [stormsById, setStormsById] = useState<Map<string, StormEvent>>(new Map())
  const [updated, setUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [sev, setSev] = useState<SevFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  async function refresh() {
    setRefreshing(true)
    try {
      const [ziRes, stRes] = await Promise.all([
        fetch("/api/zip-insights?limit=1500", { cache: "no-store" }),
        fetch("/api/storms", { cache: "no-store" }),
      ])
      if (ziRes.ok) {
        const data = (await ziRes.json()) as { events: ZipInsightEvent[] }
        setInsights(data.events)
      }
      if (stRes.ok) {
        const data = (await stRes.json()) as { storms: StormEvent[] }
        setStormsById(new Map(data.storms.map((s) => [s.id, s])))
      }
      setUpdated(new Date())
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const id = setInterval(() => void refresh(), 60000)
    return () => {
      clearTimeout(initial)
      clearInterval(id)
    }
  }, [])

  useLiveEvents(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void refresh(), 300)
  })

  const filtered = useMemo(() => {
    const q = query.trim()
    const minRank = SEV_FILTERS.find((f) => f.key === sev)?.minRank ?? 0
    return insights
      .filter((z) => severityRank(z.severity) >= minRank)
      .filter((z) => (q ? z.zip.startsWith(q) : true))
      .sort((a, b) => {
        const s = severityRank(b.severity) - severityRank(a.severity)
        if (s !== 0) return s
        return a.distanceMeters - b.distanceMeters
      })
  }, [insights, query, sev])

  // Effective selection without setting state during render: keep the chosen
  // ZIP if it's still in the filtered set, else fall back to the top result.
  const activeId =
    selectedId && filtered.some((z) => z.id === selectedId)
      ? selectedId
      : (filtered[0]?.id ?? null)
  const active = filtered.find((z) => z.id === activeId) ?? null
  const activeStorm = active ? stormsById.get(active.stormId) : undefined

  const enrichedCount = useMemo(
    () => filtered.filter((z) => z.nowcast != null).length,
    [filtered],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              maxLength={5}
              placeholder="Filter by ZIP code…"
              className="w-full rounded-md border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-sky-400/50"
            />
          </div>
          <div className="flex items-center gap-1">
            {SEV_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSev(f.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  sev === f.key
                    ? "bg-sky-500/15 text-sky-300"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>
            <span className="font-semibold text-zinc-300">{filtered.length}</span>{" "}
            reports · {enrichedCount} enriched
          </span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* List */}
        <Card className={`${GLASS} flex h-[620px] flex-col gap-0 p-0`}>
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">
            Threatened ZIPs
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-500">
              {insights.length === 0
                ? "No ZIPs under active storms right now. The feed refreshes automatically."
                : "No ZIPs match this filter."}
            </div>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {filtered.map((z) => {
                const color = severityHex(z.severity)
                const isActive = z.id === activeId
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setSelectedId(z.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                      isActive
                        ? "border-white/30 bg-white/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-mono text-sm font-semibold tabular-nums text-zinc-100">
                      {z.zip}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">
                      {z.eventType}
                    </span>
                    {z.nowcast && (
                      <span className="shrink-0 rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                        nowcast
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                      {(z.distanceMeters / 1609.344).toFixed(1)} mi
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* Detail report */}
        <Card className={`${GLASS} flex h-[620px] flex-col gap-0 overflow-hidden p-0 lg:col-span-2`}>
          {active ? (
            <ReportDetail insight={active} storm={activeStorm} />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-500">
              Select a ZIP to view its storm report.
            </div>
          )}
        </Card>
      </div>

      <p className="text-center text-[11px] text-zinc-600">
        Live data · NWS alerts + Tomorrow.io nowcast · updated{" "}
        {updated ? updated.toLocaleTimeString() : "—"}
      </p>
    </div>
  )
}

function ReportDetail({
  insight,
  storm,
}: {
  insight: ZipInsightEvent
  storm: StormEvent | undefined
}) {
  const color = severityHex(insight.severity)
  const n = insight.nowcast
  const startedAt = storm?.startedAt ?? null
  const expiresAt = storm?.expiresAt ?? insight.expiresAt
  const headline = storm?.headline ?? insight.headline
  const area = storm?.areaDesc ?? insight.areaDesc
  const description = storm?.description ?? null
  const instruction = storm?.instruction ?? null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold tabular-nums text-zinc-50">
              {insight.zip}
            </span>
            <Badge
              variant="outline"
              className="border-transparent text-[11px] font-semibold uppercase tracking-wide"
              style={{ color, backgroundColor: `${color}22` }}
            >
              {insight.severity}
            </Badge>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-white/15 bg-white/5 text-[10px] text-zinc-300"
          >
            {SOURCE_LABEL[insight.source]}
          </Badge>
        </div>
        <div className="mt-1.5 text-sm font-medium text-zinc-200">
          {insight.eventType}
        </div>
        {headline && (
          <div className="mt-0.5 text-xs leading-5 text-zinc-400">{headline}</div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Facts */}
        <div className="grid grid-cols-1 gap-2 text-xs text-zinc-400 sm:grid-cols-2">
          {area && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
              <span className="line-clamp-2">{area}</span>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
            <span>
              {formatTime(startedAt)} → {formatTime(expiresAt)}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Gauge className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
            <span>{(insight.distanceMeters / 1609.344).toFixed(1)} mi from storm center</span>
          </div>
          {storm?.senderName && (
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
              <span className="line-clamp-1">{storm.senderName}</span>
            </div>
          )}
        </div>

        {/* Nowcast */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <CloudRain className="size-3.5 text-sky-400" />
            Tomorrow.io nowcast
          </div>
          {n ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat icon={<Wind className="size-3.5" />} label="Wind gust" value={n.windGust != null ? `${Math.round(n.windGust)} mph` : "—"} />
              <Stat icon={<CloudRain className="size-3.5" />} label="Precip" value={n.precipIntensity != null ? `${n.precipIntensity.toFixed(2)} in/hr` : "—"} />
              <Stat icon={<Thermometer className="size-3.5" />} label="Temp" value={n.temperature != null ? `${Math.round(n.temperature)}°F` : "—"} />
              <Stat icon={<Gauge className="size-3.5" />} label="Conditions" value={n.weatherLabel ?? "—"} />
            </div>
          ) : (
            <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-500">
              Not yet enriched — nowcast calls are budget-prioritized to the most
              severe ZIPs. This report will fill in automatically on a later
              cycle.
            </p>
          )}
        </div>

        {/* Safety instruction */}
        {instruction && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-5 text-amber-100/90">{instruction}</p>
          </div>
        )}

        {/* Description */}
        {description && (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Details
            </div>
            <p className="whitespace-pre-line text-xs leading-5 text-zinc-400">
              {description}
            </p>
          </div>
        )}

        {storm?.nwsUrl && (
          <a
            href={storm.nwsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
          >
            <ExternalLink className="size-3.5" />
            Source alert
          </a>
        )}
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <span className="text-sky-400">{icon}</span>
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  )
}
