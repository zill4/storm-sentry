import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { requireAdminSession } from "@/lib/auth/roles"
import { ownsRequest, resolveDraftContext } from "@/lib/design/access"
import { getDesign, getRequest } from "@/lib/design/store"
import { getObject } from "@/lib/storage/bucket"

export const dynamic = "force-dynamic"

/** Stream a generated design PNG to its owner. ?raw=1 serves the pre-QR image. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const { id } = await params
  const design = await getDesign(id)
  if (!design) return NextResponse.json({ error: "not found" }, { status: 404 })

  const request = await getRequest(design.requestId)
  const ctx = await resolveDraftContext()
  const admin = await requireAdminSession()
  if (!request || (!admin && !ownsRequest(ctx, request))) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const raw = new URL(req.url).searchParams.get("raw") === "1"
  const key = raw ? (design.rawStorageKey ?? design.storageKey) : design.storageKey
  if (!key) return NextResponse.json({ error: "image not ready" }, { status: 409 })

  const obj = await getObject(key)
  if (!obj) return NextResponse.json({ error: "file missing from storage" }, { status: 404 })
  return new Response(obj.body, {
    headers: {
      "Content-Type": "image/png",
      ...(obj.contentLength ? { "Content-Length": String(obj.contentLength) } : {}),
      "Cache-Control": "private, max-age=3600",
    },
  })
}
