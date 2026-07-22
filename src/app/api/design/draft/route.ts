import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { resolveDraftContext } from "@/lib/design/access"
import {
  DRAFT_COOKIE,
  DRAFT_COOKIE_MAX_AGE,
  createDraft,
  draftCompleteness,
  listUploads,
  sanitizeDraftPatch,
  updateDraft,
} from "@/lib/design/store"

export const dynamic = "force-dynamic"

function dbUnavailable() {
  return NextResponse.json(
    { error: "design studio is unavailable (no database configured)" },
    { status: 503 },
  )
}

async function draftPayload(draft: NonNullable<Awaited<ReturnType<typeof createDraft>>>) {
  const uploads = await listUploads(draft.id)
  return {
    draft,
    uploads: uploads.map((u) => ({
      id: u.id,
      kind: u.kind,
      fileName: u.fileName,
      contentType: u.contentType,
      sizeBytes: u.sizeBytes,
      width: u.width,
      height: u.height,
    })),
    completeness: draftCompleteness(draft, uploads),
  }
}

/** Current draft (or null) for this visitor — session user first, cookie second. */
export async function GET() {
  if (!isDbConfigured()) return dbUnavailable()
  const ctx = await resolveDraftContext()
  if (!ctx.draft) return NextResponse.json({ draft: null })
  return NextResponse.json(await draftPayload(ctx.draft))
}

/** Create (or return) the draft, minting the anonymous ownership cookie. */
export async function POST() {
  if (!isDbConfigured()) return dbUnavailable()
  const ctx = await resolveDraftContext()
  if (ctx.draft) return NextResponse.json(await draftPayload(ctx.draft))

  // Always mint a fresh key: the cookie may still point at a finished
  // (submitted) request whose row keeps its draft_key, and draft_key is unique.
  const draftKey = randomBytes(18).toString("base64url")
  const draft = await createDraft({ draftKey, userId: ctx.userId })
  const res = NextResponse.json(await draftPayload(draft))
  res.cookies.set(DRAFT_COOKIE, draftKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: DRAFT_COOKIE_MAX_AGE,
    path: "/",
  })
  return res
}

/** Merge wizard answers into the draft. */
export async function PATCH(req: Request) {
  if (!isDbConfigured()) return dbUnavailable()
  const ctx = await resolveDraftContext()
  if (!ctx.draft) return NextResponse.json({ error: "no draft" }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  const patch = sanitizeDraftPatch(body)
  const updated = await updateDraft(ctx.draft.id, patch)
  if (!updated) return NextResponse.json({ error: "draft not found" }, { status: 404 })
  return NextResponse.json(await draftPayload(updated))
}
