import { NextResponse } from "next/server"
import { listBusinessesWithStatus } from "@/lib/businesses/status"

export const dynamic = "force-dynamic"

export function GET() {
  const businesses = listBusinessesWithStatus()
  const alertedCount = businesses.filter((b) => b.status === "alerted").length
  return NextResponse.json({
    count: businesses.length,
    alertedCount,
    fetchedAt: new Date().toISOString(),
    businesses,
  })
}
