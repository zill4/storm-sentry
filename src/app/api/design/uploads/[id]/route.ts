import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { requireAdminSession } from "@/lib/auth/roles"
import { ownsRequest, resolveDraftContext } from "@/lib/design/access"
import { getRequest, getUpload } from "@/lib/design/store"
import { getObject } from "@/lib/storage/bucket"

export const dynamic = "force-dynamic"

/** Stream an uploaded file back to its owner (powers wizard previews). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const { id } = await params
  const upload = await getUpload(id)
  if (!upload) return NextResponse.json({ error: "not found" }, { status: 404 })

  const request = await getRequest(upload.requestId)
  const ctx = await resolveDraftContext()
  const admin = await requireAdminSession()
  if (!request || (!admin && !ownsRequest(ctx, request))) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const obj = await getObject(upload.storageKey)
  if (!obj) return NextResponse.json({ error: "file missing from storage" }, { status: 404 })
  return new Response(obj.body, {
    headers: {
      "Content-Type": upload.contentType,
      ...(obj.contentLength ? { "Content-Length": String(obj.contentLength) } : {}),
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${upload.fileName.replace(/"/g, "")}"`,
    },
  })
}
