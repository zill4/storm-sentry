import { NextResponse } from "next/server"

import { getServerSession } from "@/lib/auth/session"
import { referralSummary } from "@/lib/referrals/store"

export const dynamic = "force-dynamic"

// Aggregate referral/visit picture (no PII — counts only). Signed-in users
// only: this is operator telemetry, not a public surface.
// Query: ?days=30
export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }
  const daysRaw = Number(new URL(req.url).searchParams.get("days") ?? 30)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 365) : 30
  return NextResponse.json(await referralSummary(days))
}
