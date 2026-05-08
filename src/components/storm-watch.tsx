"use client"

import { useEffect, useRef, useState } from "react"
import { CircleDot, RefreshCw, Wifi, WifiOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StormMap } from "@/components/storm-map"
import { StormsTable } from "@/components/storms-table"
import { useLiveEvents } from "@/lib/use-live-events"
import type { StormEvent } from "@/lib/storms/types"

type Props = {
  initialStorms: StormEvent[]
  refreshIntervalMs?: number
}

export function StormWatch({ initialStorms, refreshIntervalMs = 60000 }: Props) {
  const [storms, setStorms] = useState<StormEvent[]>(initialStorms)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [live, setLive] = useState(false)
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
    // Any storm/match/fixture change: refetch.
    debouncedRefresh()
  })

  useEffect(() => {
    // Fallback polling at a slow cadence in case SSE disconnects unnoticed.
    const id = setInterval(refresh, refreshIntervalMs)
    return () => clearInterval(id)
  }, [refreshIntervalMs])

  const withGeom = storms.filter((s) => s.geometry).length

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden rounded-lg border-zinc-200 bg-white p-0">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-100 p-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDot className="size-4 text-emerald-600" />
              Live US Storm Watch
            </CardTitle>
            <CardDescription>
              {storms.length} active alerts · {withGeom} with geometry · refreshed{" "}
              {lastRefresh.toLocaleTimeString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={live ? "bg-emerald-50 text-emerald-900" : "bg-zinc-50 text-zinc-600"}
            >
              {live ? <Wifi className="mr-1 size-3" /> : <WifiOff className="mr-1 size-3" />}
              {live ? "live" : "offline"}
            </Badge>
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
        </CardHeader>
        <CardContent className="p-0">
          <StormMap
            storms={storms}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </CardContent>
      </Card>

      <Card className="rounded-lg border-zinc-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Active alerts</CardTitle>
          <CardDescription>
            Sorted by severity then most recent. Click a row to highlight on the map.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StormsTable
            storms={storms}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
