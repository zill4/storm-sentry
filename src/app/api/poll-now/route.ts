import { NextResponse } from "next/server"

import {
  demoEndpointsBlockedResponse,
  demoEndpointsEnabled,
} from "@/lib/demo-guard"
import { runOnePoll } from "@/lib/storms/poller"

export const dynamic = "force-dynamic"

export async function POST() {
  if (!demoEndpointsEnabled()) return demoEndpointsBlockedResponse()
  const result = await runOnePoll()
  return NextResponse.json(result)
}

export async function GET() {
  if (!demoEndpointsEnabled()) return demoEndpointsBlockedResponse()
  const result = await runOnePoll()
  return NextResponse.json(result)
}
