import { NextResponse } from "next/server"
import { z } from "zod"

import { severityRank } from "@/lib/storms/types"
import {
  listZipInsights,
  markExported,
  zipInsightStats,
} from "@/lib/zip-insights/store"
import { getPlace } from "@/lib/zips/places"

export const dynamic = "force-dynamic"

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// GET /api/zip-insights — the export endpoint. Lists the queue of ZIP-level
// storm insights with optional filters, or streams NDJSON for distribution.
// Query: ?status=queued|enriched|exported  ?minSeverity=Severe  ?source=nws|tomorrow|fixture
//        ?enriched=true  ?limit=500  ?format=ndjson
export function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const status = params.get("status")
  const source = params.get("source")
  const minSeverity = params.get("minSeverity")
  const enrichedOnly = params.get("enriched") === "true"
  const format = params.get("format")
  const limitRaw = Number(params.get("limit") ?? 500)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 500

  let events = listZipInsights()
  if (status) events = events.filter((e) => e.status === status)
  if (source) events = events.filter((e) => e.source === source)
  if (enrichedOnly) events = events.filter((e) => e.nowcast != null)
  if (minSeverity) {
    const min = severityRank(titleCase(minSeverity))
    events = events.filter((e) => severityRank(e.severity) >= min)
  }

  events.sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity)
    if (sev !== 0) return sev
    return b.updatedAt.localeCompare(a.updatedAt)
  })
  // Additive enrichment: city/state label per ZIP (server-only dataset), so
  // clients can render and search by place without shipping the dataset.
  const enriched = events
    .slice(0, limit)
    .map((e) => ({ ...e, place: getPlace(e.zip) }))

  if (format === "ndjson") {
    const body = enriched.map((e) => JSON.stringify(e)).join("\n")
    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": 'attachment; filename="zip-insights.ndjson"',
        "Cache-Control": "no-store",
      },
    })
  }

  return NextResponse.json({
    count: enriched.length,
    stats: zipInsightStats(),
    fetchedAt: new Date().toISOString(),
    events: enriched,
  })
}

// POST /api/zip-insights — mark insights as exported (dequeue).
// Body: { ids: string[] } or { all: true }.
const ExportBody = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
})

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    raw = {}
  }
  const parsed = ExportBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const ids = parsed.data.all
    ? listZipInsights().map((e) => e.id)
    : parsed.data.ids ?? []
  const exported = markExported(ids)
  return NextResponse.json({ ok: true, exported })
}
