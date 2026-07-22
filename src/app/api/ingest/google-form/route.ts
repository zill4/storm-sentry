import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { ingestGoogleFormResponse, type IngestPayload } from "@/lib/design/ingest"

export const dynamic = "force-dynamic"

function secretOk(req: Request): boolean {
  const expected = process.env.GOOGLE_FORM_WEBHOOK_SECRET
  if (!expected) return false
  const got = req.headers.get("x-ingest-secret") ?? ""
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Receives Google Form submissions from the Apps Script forwarder (and the
 * CSV backfill script). Guarded by GOOGLE_FORM_WEBHOOK_SECRET — the route is
 * disabled entirely until that env var is set.
 */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  if (!secretOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let payload: IngestPayload
  try {
    payload = (await req.json()) as IngestPayload
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  if (!payload.namedValues || typeof payload.namedValues !== "object") {
    return NextResponse.json({ error: "namedValues required" }, { status: 400 })
  }

  try {
    const { request, created } = await ingestGoogleFormResponse(payload)
    return NextResponse.json({
      ok: true,
      created,
      requestId: request?.id ?? null,
      duplicate: !created,
    })
  } catch (err) {
    console.error("[ingest] google form ingest failed", err)
    return NextResponse.json({ error: "ingest failed" }, { status: 500 })
  }
}
