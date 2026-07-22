import { NextResponse } from "next/server"
import sharp from "sharp"

import { isDbConfigured } from "@/lib/db/client"
import { resolveDraftContext } from "@/lib/design/access"
import { newId } from "@/lib/design/ids"
import {
  addUpload,
  deleteUpload,
  getUpload,
  listUploads,
} from "@/lib/design/store"
import {
  LOGO_ACCEPTED_TYPES,
  LOGO_MAX_BYTES,
  LOGO_MIN_WIDTH_PX,
} from "@/lib/design/types"
import { deleteObject, isBucketConfigured, putObject } from "@/lib/storage/bucket"

export const dynamic = "force-dynamic"

const MAX_FILES = 5 // mirrors the Google Form's "up to 5 supported files"

// sharp can probe raster formats; PDF/EPS/PSD dimensions are skipped.
const PROBEABLE = new Set(["image/jpeg", "image/png", "image/tiff"])

/** Upload a logo file into the draft. */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  if (!isBucketConfigured()) return NextResponse.json({ error: "file storage is not configured" }, { status: 503 })
  const ctx = await resolveDraftContext()
  if (!ctx.draft) return NextResponse.json({ error: "no draft" }, { status: 404 })

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file field" }, { status: 400 })
  }
  if (file.size > LOGO_MAX_BYTES) {
    return NextResponse.json({ error: "File is over the 10 MB limit." }, { status: 413 })
  }
  const contentType = file.type || "application/octet-stream"
  if (!(LOGO_ACCEPTED_TYPES as readonly string[]).includes(contentType)) {
    return NextResponse.json(
      { error: "Unsupported file type. Send PDF, JPEG, PNG, EPS, TIFF, or PSD." },
      { status: 415 },
    )
  }
  const existing = await listUploads(ctx.draft.id)
  if (existing.length >= MAX_FILES) {
    return NextResponse.json({ error: `Limit is ${MAX_FILES} files per request.` }, { status: 409 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let width: number | null = null
  let height: number | null = null
  if (PROBEABLE.has(contentType)) {
    try {
      const meta = await sharp(buffer).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
    } catch {
      // Unreadable image data — keep the upload, just without dimensions.
    }
  }

  const uploadId = newId("du")
  const safeName = (file.name || "logo").replace(/[^\w.-]+/g, "_").slice(0, 120)
  const storageKey = `requests/${ctx.draft.id}/uploads/${uploadId}/${safeName}`
  await putObject(storageKey, buffer, contentType)

  const row = await addUpload({
    requestId: ctx.draft.id,
    kind: "logo",
    fileName: file.name || safeName,
    contentType,
    sizeBytes: file.size,
    storageKey,
    width,
    height,
  })

  // The form asks for high-res art; warn (not block) when a raster is clearly under it.
  const lowRes = width !== null && width < LOGO_MIN_WIDTH_PX
  return NextResponse.json({
    upload: {
      id: row.id,
      kind: row.kind,
      fileName: row.fileName,
      contentType: row.contentType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
    },
    warning: lowRes
      ? `That image is ${width}px wide — for a crisp print we recommend at least ${LOGO_MIN_WIDTH_PX}px (ideally 5000px) or a vector PDF. You can continue, or upload a larger file.`
      : null,
  })
}

/** Remove an uploaded file from the draft. Body: { uploadId }. */
export async function DELETE(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const ctx = await resolveDraftContext()
  if (!ctx.draft) return NextResponse.json({ error: "no draft" }, { status: 404 })

  let body: { uploadId?: string }
  try {
    body = (await req.json()) as { uploadId?: string }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  if (!body.uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 })

  const upload = await getUpload(body.uploadId)
  if (!upload || upload.requestId !== ctx.draft.id) {
    return NextResponse.json({ error: "upload not found" }, { status: 404 })
  }
  await deleteUpload(upload.id)
  try {
    await deleteObject(upload.storageKey)
  } catch (err) {
    console.error("[design] bucket delete failed (row removed)", err)
  }
  return NextResponse.json({ ok: true })
}
