import { NextResponse } from "next/server"
import { listActiveStorms } from "@/lib/storms/store"
import { severityRank } from "@/lib/storms/types"

export const dynamic = "force-dynamic"

export function GET() {
  const storms = listActiveStorms()
  storms.sort((a, b) => {
    const sevDiff = severityRank(b.severity) - severityRank(a.severity)
    if (sevDiff !== 0) return sevDiff
    const aStarted = a.startedAt ?? ""
    const bStarted = b.startedAt ?? ""
    return bStarted.localeCompare(aStarted)
  })
  return NextResponse.json({
    count: storms.length,
    fetchedAt: new Date().toISOString(),
    storms,
  })
}
