import { NextResponse } from "next/server"
import { getPollerStatus, listActiveStorms } from "@/lib/storms/store"

export const dynamic = "force-dynamic"

export function GET() {
  const poller = getPollerStatus()
  const storms = listActiveStorms()
  return NextResponse.json({
    app: "storm-sentry-poc",
    status: "ok",
    stack: {
      framework: "Next.js 16",
      ui: "shadcn/ui",
      styling: "Tailwind CSS 4",
    },
    poller,
    activeStormCount: storms.length,
  })
}
