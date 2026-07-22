import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/auth/roles"
import { isDbConfigured } from "@/lib/db/client"
import { qrSvg } from "@/lib/qr/image"
import { getQrLink, qrUrl } from "@/lib/qr/store"

export const dynamic = "force-dynamic"

/** Admin: vector QR for the print bundle (scales losslessly at any size). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 })

  const { slug } = await params
  const link = await getQrLink(slug)
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 })

  const svg = await qrSvg(qrUrl(slug))
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="qr-${slug}.svg"`,
      "Cache-Control": "private, no-store",
    },
  })
}
