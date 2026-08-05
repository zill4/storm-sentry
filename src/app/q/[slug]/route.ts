import { NextResponse } from "next/server"

import { appBaseUrl } from "@/lib/app-url"

export const dynamic = "force-dynamic"

// Legacy QR forwarder. The Smart Tarp funnel now lives in its own app
// (brandall-smart-studio) and owns both the qr_links table and the canonical
// /q/{slug} route. Tarps printed while the funnel lived here still encode
// THIS origin, and they're nailed to roofs — so the path stays, forwarding to
// the studio, which resolves the slug and issues the real redirect.
//
// 302 the whole way down: the destination behind a slug stays editable for the
// life of the tarp, so nothing (browsers, proxies) may cache the mapping.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const studio = process.env.STUDIO_BASE_URL?.replace(/\/+$/, "")
  if (!studio) {
    // This URL is on printed material we can't recall, so never dead-end —
    // but make the misconfiguration loud.
    console.error("[qr] STUDIO_BASE_URL is unset; cannot forward printed QR codes")
    return NextResponse.redirect(appBaseUrl(), 302)
  }
  return NextResponse.redirect(`${studio}/q/${encodeURIComponent(slug)}`, 302)
}
