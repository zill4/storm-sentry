import { NextResponse } from "next/server"

import {
  demoEndpointsBlockedResponse,
  demoEndpointsEnabled,
} from "@/lib/demo-guard"
import { clearFixtureStorms } from "@/lib/storms/fixtures"

export const dynamic = "force-dynamic"

export async function POST() {
  if (!demoEndpointsEnabled()) return demoEndpointsBlockedResponse()
  const removed = clearFixtureStorms()
  return NextResponse.json({ ok: true, removed })
}

export async function GET() {
  if (!demoEndpointsEnabled()) return demoEndpointsBlockedResponse()
  const removed = clearFixtureStorms()
  return NextResponse.json({ ok: true, removed })
}
