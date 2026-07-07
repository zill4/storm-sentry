import { NextResponse } from "next/server"
import { alertGateStats } from "@/lib/alerts/gate"
import { ghlStats } from "@/lib/ghl/notifier"
import { getPollerStatus, listActiveStorms } from "@/lib/storms/store"
import { budgetStatus } from "@/lib/tomorrow/budget"
import { zipInsightStats } from "@/lib/zip-insights/store"
import { zipCount } from "@/lib/zips/store"

export const dynamic = "force-dynamic"

export function GET() {
  const poller = getPollerStatus()
  const storms = listActiveStorms()
  return NextResponse.json({
    app: "storm-sentry",
    status: "ok",
    stack: {
      framework: "Next.js 16",
      ui: "shadcn/ui",
      styling: "Tailwind CSS 4",
    },
    poller,
    activeStormCount: storms.length,
    zipCoverage: zipCount(),
    zipInsights: zipInsightStats(),
    tomorrow: budgetStatus(),
    alertGate: alertGateStats(),
    ghl: ghlStats(),
  })
}
