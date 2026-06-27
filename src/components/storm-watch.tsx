"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { MapPin, RefreshCw, X } from "lucide-react"

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

const CARD = "rounded-2xl border border-[#D7E0EA] bg-[#FFFFFF] shadow-sm"
const LABEL = "text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]"
const SEVERITY_ORDER = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const

export function StormWatch({ initialStorms, refreshIntervalMs = 60000 }: Props) {
  const [storms, setStorms] = useState<StormEvent[]>(initialStorms)
  const [zipInsights, setZipInsights] = useState<ZipInsightEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [live, setLive] = useState(false)
  const [showRadar, setShowRadar] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<{ id: string; seq: number } | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)

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

  // IDs the map should dim out while a type filter is active.
  const dimmedIds = useMemo(() => {
    if (!typeFilter) return undefined
    return storms.filter((s) => s.eventType !== typeFilter).map((s) => s.id)
  }, [storms, typeFilter])

  function toggleTypeFilter(type: string) {
    setTypeFilter((cur) => (cur === type ? null : type))
  }

  // List-row clicks select, fly the map, and scroll the hero panel into view.
  // (Map clicks only select — flyTo.seq increments here, never on map clicks.)
  function selectFromList(id: string) {
    const next = selectedId === id ? null : id
    setSelectedId(next)
    if (next) {
      setFlyTo((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }))
      heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Hero map panel */}
      <Card
        ref={heroRef}
        className={`${CARD} gap-0 overflow-hidden p-0 lg:col-span-2`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
              Live severe-weather map
            </span>
            <h1 className="font-display text-3xl tracking-tight text-[#0B2037]">
              Live storms
            </h1>
            <p className="mt-1 text-sm leading-6 text-[#5A6B7E]">
              NWS severe-weather alerts over live radar, resolved to the ZIP code.
            </p>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-[#E4EBF3] px-3 py-2">
            <span className="relative flex size-2.5">
              {live && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#2FA37A] opacity-75" />
              )}
              <span
                className={`relative inline-flex size-2.5 rounded-full ${
                  live ? "bg-[#2FA37A]" : "bg-[#8B98A8]"
                }`}
              />
            </span>
            <div>
              <div className="text-sm font-semibold leading-tight text-[#0B2037]">
                {live ? "Feed live" : "Feed offline"}
              </div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#5A6B7E]">
                streaming NWS alerts
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 px-5 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#5A6B7E]">
            Radar
            <Switch checked={showRadar} onCheckedChange={(c) => setShowRadar(c)} />
          </label>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-[#D7E0EA] bg-transparent text-[#0B2037] hover:bg-[#E4EBF3]"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            Refresh
          </Button>
        </div>

        <div className="h-[520px] lg:h-[600px]">
          <StormMap
            storms={storms}
            zipInsights={zipInsights}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showRadar={showRadar}
            flyTo={flyTo}
            dimmedIds={dimmedIds}
          />
        </div>

        <div className="m-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-xl bg-[#E4EBF3] px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-semibold tabular-nums text-[#0B2037]">
              {stats.total}
            </span>
            <span className={LABEL}>Active alerts</span>
          </div>
          <div className="text-[11px] tabular-nums text-[#5A6B7E]">
            Updated {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"} ·{" "}
            {stats.severe} severe
          </div>
        </div>
      </Card>

      {/* Instrument rail */}
      <div className="flex flex-col gap-4">
        <Card className={`${CARD} gap-3 p-5 transition-shadow hover:shadow-md`}>
          <div className={LABEL}>Alerts by type</div>
          <AlertsByType
            storms={storms}
            typeFilter={typeFilter}
            onToggle={toggleTypeFilter}
          />
        </Card>

        <Card className={`${CARD} gap-3 p-5 transition-shadow hover:shadow-md`}>
          <div className={LABEL}>Severity</div>
          <SeverityBar storms={storms} />
        </Card>

        <Card className="gap-2.5 rounded-2xl border border-[#103153] bg-[#0B2037] p-5 text-white shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[#1FA6E5]">
            Threatened ZIPs
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl font-semibold tabular-nums text-white">
              {stats.distinctZips}
            </span>
            <span className="text-[11px] text-[#91A8BF]">
              {stats.enriched > 0
                ? `${stats.enriched} enriched`
                : "awaiting enrichment"}
            </span>
          </div>
          <WorstZips insights={zipInsights} />
          <Link
            href="/reports"
            className="mt-1 inline-flex w-fit items-center rounded-full bg-[#1FA6E5] px-4 py-2 text-xs font-semibold text-[#06121F] transition hover:bg-[#1FA6E5]/90"
          >
            Open ZIP reports →
          </Link>
        </Card>
      </div>

      {/* Full-width activity panel */}
      <Card
        className={`${CARD} gap-0 p-0 transition-shadow hover:shadow-md lg:col-span-3`}
      >
        <Tabs defaultValue="storms" className="gap-0">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#D7E0EA] px-5 py-3">
            <div>
              <div className={LABEL}>Active alerts</div>
              <h2 className="font-display text-xl tracking-tight text-[#0B2037]">
                All activity
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {typeFilter && (
                <button
                  type="button"
                  onClick={() => setTypeFilter(null)}
                  className="flex items-center gap-1.5 rounded-full bg-[#E4EBF3] px-3 py-1 text-xs font-medium text-[#0B2037] transition hover:bg-[#D7E0EA]"
                >
                  {typeFilter}
                  <X className="size-3" />
                </button>
              )}
              <TabsList variant="line" className="h-8">
                <TabsTrigger
                  value="storms"
                  className="text-[#5A6B7E] hover:text-[#0B2037] data-active:text-[#0B2037] after:bg-[#0B2037]"
                >
                  Storms ({storms.length})
                </TabsTrigger>
                <TabsTrigger
                  value="zips"
                  className="text-[#5A6B7E] hover:text-[#0B2037] data-active:text-[#0B2037] after:bg-[#0B2037]"
                >
                  ZIPs ({stats.distinctZips})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <TabsContent value="storms">
            <ActiveStormsList
              storms={storms}
              selectedId={selectedId}
              typeFilter={typeFilter}
              now={lastRefresh ? lastRefresh.getTime() : null}
              onSelect={selectFromList}
            />
          </TabsContent>
          <TabsContent value="zips">
            <ZipInsightsList insights={zipInsights} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}

// Top event types by alert count; rows toggle the dashboard-wide type filter.
function AlertsByType({
  storms,
  typeFilter,
  onToggle,
}: {
  storms: StormEvent[]
  typeFilter: string | null
  onToggle: (type: string) => void
}) {
  const rows = useMemo(() => {
    const byType = new Map<string, { count: number; topRank: number; topSeverity: string }>()
    for (const s of storms) {
      const cur =
        byType.get(s.eventType) ?? { count: 0, topRank: -1, topSeverity: "Unknown" }
      cur.count += 1
      const rank = severityRank(s.severity)
      if (rank > cur.topRank) {
        cur.topRank = rank
        cur.topSeverity = s.severity
      }
      byType.set(s.eventType, cur)
    }
    return [...byType.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.count - a.count || b.topRank - a.topRank)
      .slice(0, 6)
  }, [storms])

  if (rows.length === 0) {
    return <div className="py-2 text-sm text-[#8B98A8]">No active alerts.</div>
  }

  const maxCount = Math.max(...rows.map((r) => r.count), 1)

  return (
    <div className="flex flex-col gap-1">
      {rows.map((r) => {
        const active = typeFilter === r.type
        return (
          <button
            key={r.type}
            type="button"
            onClick={() => onToggle(r.type)}
            aria-pressed={active}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
              active
                ? "bg-[#E4EBF3] ring-1 ring-[#0B2037]/25"
                : "hover:bg-[#E4EBF3]/60"
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-sm text-[#0B2037]">
              {r.type}
            </span>
            <span className="h-2 w-16 shrink-0 rounded-full bg-[#E4EBF3]">
              <span
                className="block h-2 rounded-full"
                style={{
                  width: `${Math.max((r.count / maxCount) * 100, 8)}%`,
                  backgroundColor: severityHex(r.topSeverity),
                }}
              />
            </span>
            <span className="w-7 shrink-0 text-right font-mono text-sm tabular-nums text-[#0B2037]">
              {r.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// One stacked bar, segments in rank order, plus a count legend.
function SeverityBar({ storms }: { storms: StormEvent[] }) {
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const k of SEVERITY_ORDER) out[k] = 0
    for (const s of storms) {
      const key = (SEVERITY_ORDER as readonly string[]).includes(s.severity ?? "")
        ? (s.severity as string)
        : "Unknown"
      out[key] += 1
    }
    return out
  }, [storms])

  const total = storms.length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-[#E4EBF3]">
        {total > 0 &&
          SEVERITY_ORDER.filter((k) => counts[k] > 0).map((k) => (
            <div
              key={k}
              title={`${k} — ${counts[k]} alerts`}
              className="transition hover:opacity-80"
              style={{
                width: `${(counts[k] / total) * 100}%`,
                backgroundColor: severityHex(k),
              }}
            />
          ))}
      </div>
      <div className="flex flex-col gap-1">
        {SEVERITY_ORDER.map((k) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-[#5A6B7E]">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: severityHex(k) }}
              />
              {k}
            </span>
            <span className="font-mono tabular-nums text-[#0B2037]">
              {counts[k]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Three worst threatened ZIPs (highest severity, then closest to the storm).
function WorstZips({ insights }: { insights: ZipInsightEvent[] }) {
  const worst = useMemo(() => {
    const sorted = [...insights].sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity)
      if (sev !== 0) return sev
      return a.distanceMeters - b.distanceMeters
    })
    const seen = new Set<string>()
    const out: ZipInsightEvent[] = []
    for (const z of sorted) {
      if (seen.has(z.zip)) continue
      seen.add(z.zip)
      out.push(z)
      if (out.length === 3) break
    }
    return out
  }, [insights])

  if (worst.length === 0) {
    return (
      <div className="text-[11px] text-[#91A8BF]">
        Threatened ZIPs appear here as storms move in.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {worst.map((z) => (
        <div
          key={z.id}
          className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 transition hover:bg-white/10"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: severityHex(z.severity) }}
            />
            <span className="font-mono text-sm font-semibold tabular-nums">
              {z.zip}
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-[#91A8BF]">
            {z.nowcast?.windGust != null
              ? `${Math.round(z.nowcast.windGust)} mph`
              : `${(z.distanceMeters / 1609.344).toFixed(1)} mi`}
          </span>
        </div>
      ))}
    </div>
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

// Time-pressure chip: red inside 30 minutes, orange inside 2 hours, quiet after.
function urgencyChip(
  expiresAt: string | null,
  now: number | null,
): { label: string; className: string } {
  const neutral = "bg-[#E4EBF3] text-[#5A6B7E]"
  if (!expiresAt) return { label: "no end time", className: neutral }
  const t = new Date(expiresAt).getTime()
  if (Number.isNaN(t)) return { label: "no end time", className: neutral }
  const absolute = {
    label: `ends ${new Date(t).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`,
    className: neutral,
  }
  // Before the client clock ticks (SSR + first paint), stay absolute/neutral.
  if (now == null) return absolute
  const mins = Math.round((t - now) / 60_000)
  if (mins <= 0) return { label: "expired", className: neutral }
  if (mins < 30) {
    return {
      label: `ends in ${mins}m`,
      className: "bg-[#D93A2B]/10 text-[#D93A2B]",
    }
  }
  if (mins < 120) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return {
      label: `ends in ${h > 0 ? `${h}h ${m}m` : `${m}m`}`,
      className: "bg-[#F47A20]/20 text-[#B85614]",
    }
  }
  return absolute
}

function ActiveStormsList({
  storms,
  selectedId,
  typeFilter,
  now,
  onSelect,
}: {
  storms: StormEvent[]
  selectedId: string | null
  typeFilter: string | null
  /** Clock for the urgency chips (the dashboard's last-refresh time). */
  now: number | null
  onSelect: (id: string) => void
}) {
  const sorted = useMemo(() => {
    return [...storms]
      .filter((s) => !typeFilter || s.eventType === typeFilter)
      .sort((a, b) => {
        const sev = severityRank(b.severity) - severityRank(a.severity)
        if (sev !== 0) return sev
        return (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
      })
      .slice(0, 30)
  }, [storms, typeFilter])

  if (sorted.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-[#8B98A8]">
        {typeFilter
          ? `No active ${typeFilter} alerts. Clear the filter to see everything.`
          : "No active alerts right now. The feed refreshes automatically."}
      </div>
    )
  }

  return (
    <div>
      {sorted.map((s) => {
        const selected = s.id === selectedId
        const color = severityHex(s.severity)
        const chip = urgencyChip(s.expiresAt, now)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 border-b border-[#D7E0EA] px-4 py-3 text-left transition last:border-0 sm:grid-cols-[auto_1fr_auto_auto] ${
              selected ? "bg-[#E4EBF3]" : "hover:bg-[#E4EBF3]/60"
            }`}
          >
            <Badge
              variant="outline"
              className="w-20 justify-center border-transparent text-[10px] font-semibold uppercase tracking-wide"
              style={{ color, backgroundColor: `${color}22` }}
            >
              {s.severity}
            </Badge>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[#0B2037]">
                {s.eventType}
              </span>
              {s.areaDesc && (
                <span className="mt-0.5 flex items-start gap-1.5 text-xs text-[#5A6B7E]">
                  <MapPin className="mt-0.5 size-3 shrink-0 text-[#8B98A8]" />
                  <span className="line-clamp-2">{s.areaDesc}</span>
                </span>
              )}
            </span>
            <span className="hidden text-[11px] tabular-nums text-[#8B98A8] sm:block">
              {formatTime(s.startedAt)}
              {s.expiresAt ? ` → ${formatTime(s.expiresAt)}` : ""}
            </span>
            <span
              suppressHydrationWarning
              className={`w-fit justify-self-end rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums ${chip.className}`}
            >
              {chip.label}
            </span>
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
      .slice(0, 40)
  }, [insights])

  if (sorted.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-[#8B98A8]">
        No ZIP codes under active storms. Threatened ZIPs appear here as storms
        move in.
      </div>
    )
  }

  return (
    <div>
      {sorted.map((z) => {
        const color = severityHex(z.severity)
        const miles = (z.distanceMeters / 1609.344).toFixed(1)
        const n = z.nowcast
        return (
          <div
            key={z.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[#D7E0EA] px-4 py-2.5 transition last:border-0 hover:bg-[#E4EBF3]/60"
          >
            <span className="flex w-24 shrink-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-mono text-sm font-semibold tabular-nums text-[#0B2037]">
                {z.zip}
              </span>
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-[#5A6B7E]">
              {z.eventType}
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-[#8B98A8]">
              {miles} mi
            </span>
            <span className="flex shrink-0 flex-wrap items-center gap-1.5">
              {n?.windGust != null && (
                <span className="rounded-full bg-[#E4EBF3] px-2 py-0.5 text-[11px] tabular-nums text-[#5A6B7E]">
                  {Math.round(n.windGust)} mph gust
                </span>
              )}
              {n?.precipIntensity != null && (
                <span className="rounded-full bg-[#E4EBF3] px-2 py-0.5 text-[11px] tabular-nums text-[#5A6B7E]">
                  {n.precipIntensity.toFixed(2)} in/hr
                </span>
              )}
              {n?.weatherLabel && (
                <span className="rounded-full bg-[#E4EBF3] px-2 py-0.5 text-[11px] text-[#5A6B7E]">
                  {n.weatherLabel}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  n
                    ? "bg-[#1FA6E5]/60 text-[#0B2037]"
                    : "bg-[#E4EBF3] text-[#5A6B7E]"
                }`}
              >
                {n ? "enriched" : "queued"}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}