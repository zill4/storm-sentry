import { NextResponse } from "next/server"

// Demo/debug endpoints (fixture injection, forced polls) are open in dev but
// blocked on production deploys unless explicitly enabled — a public
// /api/replay/inject would let anyone fabricate storms that fire real webhooks
// (and, once GHL is connected, real customer notifications).
export function demoEndpointsEnabled(): boolean {
  if (process.env.ALLOW_DEMO_ENDPOINTS === "true") return true
  return process.env.NODE_ENV !== "production"
}

export function demoEndpointsBlockedResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Demo endpoints are disabled on this deployment. Set ALLOW_DEMO_ENDPOINTS=true to enable.",
    },
    { status: 403 },
  )
}
