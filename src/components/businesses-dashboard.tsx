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
  alerted: "bg-[#D9482B]/10 text-[#A8361F] ring-[#D9482B]/25",
  watching: "bg-[#D9A82B]/10 text-[#9C7A1C] ring-[#D9A82B]/25",
  idle: "bg-[#E7E3DA] text-[#6F6A5F] ring-[#DDD8CC]",
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
      <Card className="rounded-2xl border-[#DDD8CC] bg-[#F7F5F0] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#DDD8CC]">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-[#6F6A5F]" />
              Contact list
            </CardTitle>
            <CardDescription className="text-[#6F6A5F]">
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
                  ? "border-[#7BA05B]/25 bg-[#7BA05B]/10 text-[#5C7A42]"
                  : "border-[#DDD8CC] bg-[#E7E3DA] text-[#6F6A5F]"
              }
            >
              {live ? <Wifi className="mr-1 size-3" /> : <WifiOff className="mr-1 size-3" />}
              {live ? "live" : "offline"}
            </Badge>
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
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-[#9B958A]">
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
                  <TableCell className="text-sm text-[#6F6A5F]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-[#9B958A]" />
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
                      <span className="text-sm text-[#9B958A]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-[#6F6A5F]">
                    {b.nearestStorm
                      ? `${metersToMiles(b.nearestStorm.distanceMeters)} mi`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-[#9B958A]">
                    {formatTime(b.lastAlertedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={b.status === "alerted" ? "default" : "outline"}
                      size="sm"
                      className={
                        b.status === "alerted"
                          ? "rounded-full bg-[#201E1A] text-[#F7F5F0] hover:bg-[#201E1A]/90"
                          : "rounded-full border-[#DDD8CC] bg-transparent text-[#201E1A] hover:bg-[#E7E3DA]"
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
      ? "bg-[#D9482B]/10 text-[#A8361F] ring-[#D9482B]/25"
      : "bg-[#201E1A] text-[#F7F5F0] ring-[#201E1A]"
  const inactive = "bg-transparent text-[#6F6A5F] ring-[#DDD8CC] hover:bg-[#E7E3DA]"
  return (
    <button onClick={onClick} className={`${base} ${active ? activeClass : inactive}`}>
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  )
}
