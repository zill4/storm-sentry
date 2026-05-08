import { NextResponse } from "next/server"

import { deleteWebhook, getWebhook } from "@/lib/webhooks/store"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sub = getWebhook(id)
  if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ subscription: sub })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const removed = deleteWebhook(id)
  if (!removed) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
