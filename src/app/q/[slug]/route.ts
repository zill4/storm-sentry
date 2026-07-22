import { NextResponse } from "next/server"

import { appBaseUrl } from "@/lib/app-url"
import { resolveAndTrackQr } from "@/lib/qr/store"

export const dynamic = "force-dynamic"

// The URL printed inside every tarp QR code. Always a 302 — the whole point is
// that the destination stays editable after the tarp is printed, so nothing
// (browsers, proxies) may cache the mapping.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  let target: string | null = null
  try {
    target = await resolveAndTrackQr(slug)
  } catch (err) {
    console.error("[qr] resolve failed", err)
  }
  // Unknown/retired slugs land on the homepage rather than a dead end — this
  // URL is on printed material we can't recall.
  return NextResponse.redirect(target ?? appBaseUrl(), 302)
}
