import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { resolveDraftContext } from "@/lib/design/access"
import { isGenerationConfigured, startRevision } from "@/lib/design/generate"
import { getDesign } from "@/lib/design/store"
import { MAX_REVISIONS, SUPPORT_EMAIL } from "@/lib/design/types"

export const dynamic = "force-dynamic"

/** Request a revision of one design. Body: { designId, note }. */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  if (!isGenerationConfigured()) {
    return NextResponse.json(
      { error: "Image generation isn't configured yet (missing OPENAI_API_KEY)." },
      { status: 503 },
    )
  }
  const ctx = await resolveDraftContext()
  if (!ctx.userId || !ctx.draft) {
    return NextResponse.json({ error: "Sign in to revise designs." }, { status: 401 })
  }

  let body: { designId?: string; note?: string }
  try {
    body = (await req.json()) as { designId?: string; note?: string }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  const note = body.note?.trim()
  if (!body.designId || !note) {
    return NextResponse.json({ error: "designId and note are required" }, { status: 400 })
  }
  if (note.length > 2000) {
    return NextResponse.json({ error: "Keep the revision note under 2000 characters." }, { status: 400 })
  }

  const parent = await getDesign(body.designId)
  if (!parent || parent.requestId !== ctx.draft.id) {
    return NextResponse.json({ error: "design not found" }, { status: 404 })
  }
  if (ctx.draft.revisionCount >= MAX_REVISIONS) {
    return NextResponse.json(
      {
        error: `You've used all ${MAX_REVISIONS} revisions. Email ${SUPPORT_EMAIL} and our design team will take it from here.`,
        limitReached: true,
        supportEmail: SUPPORT_EMAIL,
      },
      { status: 409 },
    )
  }

  try {
    const row = await startRevision(ctx.draft, parent, note)
    return NextResponse.json(
      {
        ok: true,
        designId: row.id,
        revisionsRemaining: MAX_REVISIONS - ctx.draft.revisionCount - 1,
      },
      { status: 202 },
    )
  } catch (err) {
    const friendly = (err as { friendly?: string }).friendly
    if (friendly) return NextResponse.json({ error: friendly }, { status: 409 })
    console.error("[design] revise failed", err)
    return NextResponse.json({ error: "Could not start the revision." }, { status: 500 })
  }
}
