import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { resolveDraftContext } from "@/lib/design/access"
import { isGenerationConfigured, startInitialGeneration } from "@/lib/design/generate"
import { draftCompleteness, listUploads } from "@/lib/design/store"
import { isBucketConfigured } from "@/lib/storage/bucket"

export const dynamic = "force-dynamic"

/** Kick off the initial variant batch. Requires a signed-in, complete draft. */
export async function POST() {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  if (!isBucketConfigured()) return NextResponse.json({ error: "file storage is not configured" }, { status: 503 })
  if (!isGenerationConfigured()) {
    return NextResponse.json(
      { error: "Image generation isn't configured yet (missing OPENAI_API_KEY)." },
      { status: 503 },
    )
  }

  const ctx = await resolveDraftContext()
  if (!ctx.userId) {
    return NextResponse.json({ error: "Sign in to generate designs." }, { status: 401 })
  }
  if (!ctx.draft) return NextResponse.json({ error: "no draft" }, { status: 404 })

  const uploads = await listUploads(ctx.draft.id)
  const completeness = draftCompleteness(ctx.draft, uploads)
  if (!completeness.ready) {
    return NextResponse.json(
      { error: `Still missing: ${completeness.missing.join(", ")}.`, missing: completeness.missing },
      { status: 400 },
    )
  }

  try {
    const created = await startInitialGeneration(ctx.draft)
    return NextResponse.json({ ok: true, designIds: created.map((d) => d.id) }, { status: 202 })
  } catch (err) {
    const friendly = (err as { friendly?: string }).friendly
    if (friendly) return NextResponse.json({ error: friendly }, { status: 409 })
    console.error("[design] generate failed", err)
    return NextResponse.json({ error: "Could not start generation." }, { status: 500 })
  }
}
