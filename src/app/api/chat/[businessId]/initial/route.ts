import { NextResponse } from "next/server"

import { getBusiness, listMatchesForBusiness } from "@/lib/businesses/store"
import { listActiveStorms } from "@/lib/storms/store"
import { buildAlertText } from "@/lib/chat/templates"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params
  const business = getBusiness(businessId)
  if (!business) {
    return NextResponse.json({ error: "business not found" }, { status: 404 })
  }
  const matches = listMatchesForBusiness(businessId)
  const stormById = new Map(listActiveStorms().map((s) => [s.id, s]))
  const activeMatches = matches
    .filter((m) => stormById.has(m.stormId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const messages = activeMatches.map((m) => {
    const storm = stormById.get(m.stormId)!
    return {
      id: `alert:${m.id}`,
      role: "assistant" as const,
      parts: [
        {
          type: "text" as const,
          text: buildAlertText(business, storm, m.distanceMeters),
        },
      ],
      metadata: {
        kind: "alert",
        stormId: storm.id,
        createdAt: m.createdAt,
      },
    }
  })

  return NextResponse.json({ businessId, business, messages })
}
