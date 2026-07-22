import { NextResponse } from "next/server"

import { getServerSession } from "@/lib/auth/session"
import { isDbConfigured } from "@/lib/db/client"
import { getRequest } from "@/lib/design/store"
import { isAdminUser } from "@/lib/auth/roles"
import { getQrLink, normalizeQrTarget, updateQrTarget } from "@/lib/qr/store"

export const dynamic = "force-dynamic"

// Re-point a printed QR code. Allowed for the owner of the design request the
// link belongs to, or an admin. This is the whole point of the alias system —
// the tarp never changes, the destination does.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const session = await getServerSession()
  if (!session) return NextResponse.json({ error: "sign in required" }, { status: 401 })

  const { slug } = await params
  const link = await getQrLink(slug)
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 })

  const admin = isAdminUser(session.user)
  if (!admin) {
    const request = link.requestId ? await getRequest(link.requestId) : null
    if (!request || request.userId !== session.user.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 })
    }
  }

  let body: { targetUrl?: string }
  try {
    body = (await req.json()) as { targetUrl?: string }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  const normalized = normalizeQrTarget(body.targetUrl ?? "")
  if (!normalized) {
    return NextResponse.json(
      { error: "Enter a valid web address (https://…) or phone link (tel:…)." },
      { status: 400 },
    )
  }
  const updated = await updateQrTarget(slug, normalized)
  return NextResponse.json({ ok: true, targetUrl: updated?.targetUrl })
}
