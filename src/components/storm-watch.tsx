"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapPin, RefreshCw, Radar } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { StormMap } from "@/components/storm-map"
import { useLiveEvents } from "@/lib/use-live-events"
import { severityHex } from "@/lib/storms/severity"
import { severityRank, type StormEvent } from "@/lib/storms/types"

type Props = {
  initialStorms: StormEvent[]
  refreshIntervalMs?: number
}

const GLASS = "border-0 bg-white/[0.03] ring-1 ring-white/10 backdrop-blur"

export function StormWatch({ initialStorms, refreshIntervalMs = 60000 }: Props) {
  const [storms, setStorms] = useState<StormEvent[]>(initialStorms)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [live, setLive] = useState(false)
  const [showRadar, setShowRadar] = useState(true)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  async function refresh() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/storms", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { storms: StormEvent[] }
      setStorms(data.storms)
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

  // Set the first timestamp only after mount — `new Date()` during SSR would
  // not match the client and cause a hydration mismatch.
  useEffect(() => {
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, refreshIntervalMs)
    return () => clearInterval(id)
  }, [refreshIntervalMs])

  const stats = useMemo(() => {
    const mapped = storms.filter((s) => s.geometry).length
    const severe = storms.filter((s) => severityRank(s.severity) >= 3).length
    return { total: storms.length, mapped, severe }
  }, [storms])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active Alerts" value={stats.total} />
        <StatCard label="Severe & Above" value={stats.severe} accent="#f97316" />
        <StatCard label="Mapped" value={stats.mapped} accent="#38bdf8" />
        <Card className={`${GLASS} justify-between gap-2 py-4`}>
          <div className="px-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Feed
          </div>
          <div className="flex items-center gap-2 px-4">
            <span className="relative flex size-2.5">
              {live && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex size-2.5 rounded-full ${
                  live ? "bg-emerald-400" : "bg-zinc-500"
                }`}
              />
            </span>
            <span className="text-sm font-semibold">
              {live ? "Live" : "Offline"}
            </span>
          </div>
          <div className="px-4 text-xs text-zinc-500">
            Updated {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className={`${GLASS} gap-0 overflow-hidden p-0 lg:col-span-2`}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Radar className="size-4 text-sky-400" />
              Live Map
            </div>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                Radar
                <Switch
                  checked={showRadar}
                  onCheckedChange={(c) => setShowRadar(c)}
                />
              </label>
              <Button
                variant="outline"
                size="sm"
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
              selectedId={selectedId}
              onSelect={setSelectedId}
              showRadar={showRadar}
            />
          </div>
        </Card>

        <Card className={`${GLASS} flex h-[560px] flex-col gap-0 p-0`}>
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">
            Active Storms
          </div>
          <ActiveStormsList
            storms={storms}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <Card className={`${GLASS} gap-2 py-4`}>
      <div className="px-4 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="flex items-baseline gap-2 px-4">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {accent && (
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
      </div>
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
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-500">
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
                ? "border-white/30 bg-white/10"
                : "border-white/10 bg-white/[0.02] hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-zinc-100">
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
              <div className="mt-1.5 flex items-start gap-1.5 text-xs text-zinc-400">
                <MapPin className="mt-0.5 size-3 shrink-0 text-zinc-500" />
                <span className="line-clamp-2">{s.areaDesc}</span>
              </div>
            )}
            <div className="mt-1.5 text-[11px] tabular-nums text-zinc-500">
              {formatTime(s.startedAt)}
              {s.expiresAt ? ` → ${formatTime(s.expiresAt)}` : ""}
            </div>
          </button>
        )
      })}
    </div>
  )
}
