import { NextResponse } from "next/server"
import { z } from "zod"

import { runMatcher } from "@/lib/businesses/matcher"
import { getBusiness } from "@/lib/businesses/store"
import { injectFixtureStorm } from "@/lib/storms/fixtures"

export const dynamic = "force-dynamic"

const BodySchema = z
  .object({
    businessId: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    radiusMiles: z.number().min(1).max(200).optional(),
    eventType: z.string().optional(),
    severity: z
      .enum(["Extreme", "Severe", "Moderate", "Minor", "Unknown"])
      .optional(),
    durationMinutes: z.number().min(1).max(720).optional(),
    headline: z.string().optional(),
    areaDesc: z.string().optional(),
  })
  .refine(
    (v) =>
      v.businessId !== undefined || (v.lat !== undefined && v.lng !== undefined),
    {
      message: "Provide businessId or both lat and lng.",
    },
  )

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    raw = {}
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

  let lat = body.lat
  let lng = body.lng
  let areaDesc = body.areaDesc
  if (body.businessId) {
    const biz = getBusiness(body.businessId)
    if (!biz) {
      return NextResponse.json(
        { error: `unknown businessId ${body.businessId}` },
        { status: 404 },
      )
    }
    lat = biz.lat
    lng = biz.lng
    areaDesc = areaDesc ?? `Fixture centered on ${biz.name} (${biz.city}, ${biz.state})`
  }

  if (lat === undefined || lng === undefined) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 })
  }

  const storm = injectFixtureStorm({
    lat,
    lng,
    radiusMiles: body.radiusMiles,
    eventType: body.eventType,
    severity: body.severity,
    durationMinutes: body.durationMinutes,
    headline: body.headline,
    areaDesc,
  })
  const matcher = runMatcher()

  return NextResponse.json({ ok: true, storm, matcher })
}
