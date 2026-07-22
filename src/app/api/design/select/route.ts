import { NextResponse } from "next/server"

import { isDbConfigured } from "@/lib/db/client"
import { resolveDraftContext } from "@/lib/design/access"
import { createOrderForSelection, notifyTeamOfOrder } from "@/lib/design/orders"
import { getDesign } from "@/lib/design/store"

export const dynamic = "force-dynamic"

/** Lock in a design: creates the print order and notifies the team. */
export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no database configured" }, { status: 503 })
  const ctx = await resolveDraftContext()
  if (!ctx.userId || !ctx.draft) {
    return NextResponse.json({ error: "Sign in to submit your selection." }, { status: 401 })
  }

  let body: { designId?: string }
  try {
    body = (await req.json()) as { designId?: string }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }
  if (!body.designId) return NextResponse.json({ error: "designId required" }, { status: 400 })

  const design = await getDesign(body.designId)
  if (!design || design.requestId !== ctx.draft.id) {
    return NextResponse.json({ error: "design not found" }, { status: 404 })
  }
  if (design.status !== "succeeded") {
    return NextResponse.json({ error: "Only a completed design can be selected." }, { status: 409 })
  }

  const { order, created } = await createOrderForSelection(ctx.draft, design)
  if (created) {
    // Fire-and-forget: the customer shouldn't wait on SMTP.
    void notifyTeamOfOrder(order, ctx.draft, design).catch((err) =>
      console.error("[orders] team notification failed", err),
    )
  }
  return NextResponse.json({ ok: true, orderId: order.id, created })
}
