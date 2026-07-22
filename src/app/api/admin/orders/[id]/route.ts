import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/auth/roles"
import { isDbConfigured } from "@/lib/db/client"
import { setOrderStatus } from "@/lib/design/orders"
import { ORDER_STATUSES, type OrderStatus } from "@/lib/design/types"

export const dynamic = "force-dynamic"

/** Admin: transition an order's status. Body: { status, note? }. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const session = await requireAdminSession()
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 })

  const { id } = await params
  let body: { status?: string; note?: string }
  try {
    body = (await req.json()) as { status?: string; note?: string }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  if (!body.status || !ORDER_STATUSES.includes(body.status as OrderStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 })
  }
  const updated = await setOrderStatus(id, body.status as OrderStatus, body.note)
  if (!updated) return NextResponse.json({ error: "order not found" }, { status: 404 })
  return NextResponse.json({ ok: true, status: updated.status })
}
