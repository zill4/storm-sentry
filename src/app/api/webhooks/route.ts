import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createWebhook,
  listDeliveries,
  listWebhooks,
} from "@/lib/webhooks/store"

export const dynamic = "force-dynamic"

const CreateBody = z.object({
  url: z.string().url(),
  secret: z.string().min(1).max(256).optional(),
  events: z.array(z.string()).optional(),
})

export function GET() {
  return NextResponse.json({
    subscriptions: listWebhooks(),
    recentDeliveries: listDeliveries(20),
  })
}

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    raw = {}
  }
  const parsed = CreateBody.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const sub = createWebhook(parsed.data)
  return NextResponse.json({ ok: true, subscription: sub }, { status: 201 })
}
