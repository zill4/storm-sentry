import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { resolveDraftContext } from "@/lib/design/access"
import { listDesigns } from "@/lib/design/store"
import { MAX_REVISIONS, SUPPORT_EMAIL } from "@/lib/design/types"
import { getQrLinkForRequest, qrUrl } from "@/lib/qr/store"

export const dynamic = "force-dynamic"

/** Everything the review screen needs, refetched on each design_updated frame. */
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const ctx = await resolveDraftContext()
  if (!ctx.draft) return NextResponse.json({ request: null })

  const [designs, qr] = await Promise.all([
    listDesigns(ctx.draft.id),
    getQrLinkForRequest(ctx.draft.id),
  ])
  return NextResponse.json({
    request: {
      id: ctx.draft.id,
      status: ctx.draft.status,
      businessName: ctx.draft.businessName,
      designStyle: ctx.draft.designStyle,
      revisionCount: ctx.draft.revisionCount,
      revisionsRemaining: Math.max(0, MAX_REVISIONS - ctx.draft.revisionCount),
    },
    supportEmail: SUPPORT_EMAIL,
    qr: qr
      ? { slug: qr.slug, url: qrUrl(qr.slug), targetUrl: qr.targetUrl, hits: qr.hits }
      : null,
    designs: designs.map((d) => ({
      id: d.id,
      version: d.version,
      status: d.status,
      error: d.error,
      revisionNote: d.revisionNote,
      parentDesignId: d.parentDesignId,
      width: d.width,
      height: d.height,
      selectedAt: d.selectedAt,
      imageUrl: d.status === "succeeded" ? `/api/design/images/${d.id}` : null,
      createdAt: d.createdAt,
    })),
  })
}
