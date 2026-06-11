import { NextResponse } from "next/server"

import { getZipForecast } from "@/lib/tomorrow/forecast"
import { getZip } from "@/lib/zips/store"

export const dynamic = "force-dynamic"

// GET /api/forecast?zip=75201 — cached, budget-gated per-ZIP forecast.
// Validates the ZIP against the bundled ZCTA set first, so a bad ZIP never
// costs an API call.
export async function GET(req: Request) {
  const zip = (new URL(req.url).searchParams.get("zip") ?? "").trim()
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { ok: false, error: "Provide a 5-digit ZIP code.", retryable: false },
      { status: 400 },
    )
  }
  const place = getZip(zip)
  if (!place) {
    return NextResponse.json(
      { ok: false, error: `Unknown ZIP code: ${zip}`, retryable: false },
      { status: 404 },
    )
  }

  const result = await getZipForecast(zip)
  if (!result.ok) {
    // 503 = transient (rate limit / budget); clients can retry.
    return NextResponse.json(result, { status: 503 })
  }
  return NextResponse.json({ ...result, zip })
}
