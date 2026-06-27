"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Bell, MapPin, MessageSquare, RefreshCw, Wifi, WifiOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DemoControls } from "@/components/demo-controls"
import { useLiveEvents } from "@/lib/use-live-events"
import { severityBadgeClass } from "@/lib/storms/severity"
import { severityRank } from "@/lib/storms/types"
import type { BusinessWithStatus } from "@/lib/businesses/types"

type Props = {
  initial: BusinessWithStatus[]
  refreshIntervalMs?: number
}

const STATUS_CLASS: Record<BusinessWithStatus["status"], string> = {
  alerted: "bg-[#D93A2B]/10 text-[#B22A1E] ring-[#D93A2B]/25",
  watching: "bg-[#E0A52A]/10 text-[#9C7320] ring-[#E0A52A]/25",
  idle: "bg-[#E4EBF3] text-[#5A6B7E] ring-[#D7E0EA]",
}

const STATUS_LABEL: Record<BusinessWithStatus["status"], string> = {
  alerted: "notified",
  watching: "watching",
  idle: "idle",
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

function metersToMiles(m: number): string {
  return (m / 1609.344).toFixed(1)
}

export function BusinessesDashboard({ initial, refreshIntervalMs = 60000 }: Props) {
  const [businesses, setBusinesses] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [filter, setFilter] = useState<"all" | "alerted" | "idle">("all")
  const [live, setLive] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  async function refresh() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/businesses", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { businesses: BusinessWithStatus[] }
      setBusinesses(data.businesses)
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

  useEffect(() => {
    const id = setInterval(refresh, refreshIntervalMs)
    return () => clearInterval(id)
  }, [refreshIntervalMs])

  const sorted = useMemo(() => {
    return [...businesses]
      .filter((b) => {
        if (filter === "all") return true
        if (filter === "alerted") return b.status === "alerted"
        return b.status === "idle"
      })
      .sort((a, b) => {
        // Alerted first, then by severity, then by name.
        if (a.status === "alerted" && b.status !== "alerted") return -1
        if (b.status === "alerted" && a.status !== "alerted") return 1
        const aSev = severityRank(a.nearestStorm?.severity)
        const bSev = severityRank(b.nearestStorm?.severity)
        if (aSev !== bSev) return bSev - aSev
        return a.name.localeCompare(b.name)
      })
  }, [businesses, filter])

  const counts = useMemo(() => {
    const c = { all: businesses.length, alerted: 0, idle: 0 }
    for (const b of businesses) {
      if (b.status === "alerted") c.alerted++
      else c.idle++
    }
    return c
  }, [businesses])

  return (
    <div className="flex flex-col gap-4">
      <DemoControls onChange={refresh} />
      <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#D7E0EA]">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-[#5A6B7E]" />
              Contact list
            </CardTitle>
            <CardDescription className="text-[#5A6B7E]">
              {counts.all} contacts · {counts.alerted} notified · refreshed{" "}
              {lastRefresh.toLocaleTimeString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <FilterChip
              label="All"
              count={counts.all}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterChip
              label="Notified"
              count={counts.alerted}
              active={filter === "alerted"}
              onClick={() => setFilter("alerted")}
              tone="red"
            />
            <FilterChip
              label="Idle"
              count={counts.idle}
              active={filter === "idle"}
              onClick={() => setFilter("idle")}
            />
            <Badge
              variant="outline"
              className={
                live
                  ? "border-[#2FA37A]/25 bg-[#2FA37A]/10 text-[#247A5B]"
                  : "border-[#D7E0EA] bg-[#E4EBF3] text-[#5A6B7E]"
              }
            >
              {live ? <Wifi className="mr-1 size-3" /> : <WifiOff className="mr-1 size-3" />}
              {live ? "live" : "offline"}
            </Badge>
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-44">Location</TableHead>
                <TableHead>Nearest active storm</TableHead>
                <TableHead className="w-28">Distance</TableHead>
                <TableHead className="w-36">Last notified</TableHead>
                <TableHead className="w-24 text-right">Chat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-[#8B98A8]">
                    No contacts match the current filter.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((b) => (
                <TableRow key={b.id} data-status={b.status}>
                  <TableCell>
                    <Badge variant="outline" className={`ring-1 ${STATUS_CLASS[b.status]}`}>
                      {STATUS_LABEL[b.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-sm text-[#5A6B7E]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#8B98A8]" />
                      {b.city}, {b.state}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {b.nearestStorm ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`ring-1 ${severityBadgeClass(b.nearestStorm.severity)}`}
                        >
                          {b.nearestStorm.severity}
                        </Badge>
                        <span className="text-sm">{b.nearestStorm.eventType}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#8B98A8]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-[#5A6B7E]">
                    {b.nearestStorm
                      ? `${metersToMiles(b.nearestStorm.distanceMeters)} mi`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-[#8B98A8]">
                    {formatTime(b.lastAlertedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={b.status === "alerted" ? "default" : "outline"}
                      size="sm"
                      className={
                        b.status === "alerted"
                          ? "rounded-full bg-[#0B2037] text-[#FFFFFF] hover:bg-[#0B2037]/90"
                          : "rounded-full border-[#D7E0EA] bg-transparent text-[#0B2037] hover:bg-[#E4EBF3]"
                      }
                      render={<Link href={`/chat/${b.id}`} />}
                    >
                      <MessageSquare />
                      Chat
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  tone?: "red"
}) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition"
  const activeClass =
    tone === "red"
      ? "bg-[#D93A2B]/10 text-[#B22A1E] ring-[#D93A2B]/25"
      : "bg-[#0B2037] text-[#FFFFFF] ring-[#0B2037]"
  const inactive = "bg-transparent text-[#5A6B7E] ring-[#D7E0EA] hover:bg-[#E4EBF3]"
  return (
    <button onClick={onClick} className={`${base} ${active ? activeClass : inactive}`}>
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  )
}