"use client"

import { useMemo } from "react"
import { ExternalLink, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { severityBadgeClass } from "@/lib/storms/severity"
import { severityRank, type StormEvent } from "@/lib/storms/types"

type Props = {
  storms: StormEvent[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
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

export function StormsTable({ storms, selectedId, onSelect }: Props) {
  const sorted = useMemo(() => {
    return [...storms].sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity)
      if (sev !== 0) return sev
      const aStarted = a.startedAt ?? ""
      const bStarted = b.startedAt ?? ""
      return bStarted.localeCompare(aStarted)
    })
  }, [storms])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Severity</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Area</TableHead>
          <TableHead className="w-36">Started</TableHead>
          <TableHead className="w-36">Expires</TableHead>
          <TableHead className="w-20">Geom</TableHead>
          <TableHead className="w-12 text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="py-10 text-center text-sm text-[#9B958A]">
              No active alerts in the accepted-event filter right now. Poll runs every {process.env.NEXT_PUBLIC_POLL_INTERVAL_SECONDS ?? 60}s.
            </TableCell>
          </TableRow>
        )}
        {sorted.map((s) => {
          const isSelected = s.id === selectedId
          return (
            <TableRow
              key={s.id}
              data-selected={isSelected ? "true" : undefined}
              className={
                isSelected
                  ? "bg-[#E7E3DA]/70 hover:bg-[#E7E3DA] cursor-pointer"
                  : "cursor-pointer hover:bg-[#E7E3DA]/40"
              }
              onClick={() => {
                if (!onSelect) return
                onSelect(isSelected ? null : s.id)
              }}
            >
              <TableCell>
                <Badge
                  variant="outline"
                  className={`ring-1 ${severityBadgeClass(s.severity)}`}
                >
                  {s.severity}
                </Badge>
              </TableCell>
              <TableCell className="font-medium whitespace-normal">
                <div className="flex items-start gap-2">
                  <span>{s.eventType}</span>
                </div>
                {s.headline && (
                  <p className="mt-0.5 max-w-md truncate text-xs text-[#9B958A]">
                    {s.headline}
                  </p>
                )}
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal text-sm text-[#6F6A5F]">
                <div className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#9B958A]" />
                  <span className="line-clamp-2">{s.areaDesc ?? "—"}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm tabular-nums text-[#6F6A5F]">
                {formatTime(s.startedAt)}
              </TableCell>
              <TableCell className="text-sm tabular-nums text-[#6F6A5F]">
                {formatTime(s.expiresAt)}
              </TableCell>
              <TableCell>
                {s.geometry ? (
                  <Badge className="bg-[#7BA05B]/15 text-[#5C7A42]">yes</Badge>
                ) : (
                  <Badge variant="outline" className="border-[#DDD8CC] text-[#9B958A]">
                    none
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {s.nwsUrl && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => e.stopPropagation()}
                    render={
                      <a
                        href={s.nwsUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open NWS alert"
                      />
                    }
                  >
                    <ExternalLink />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
