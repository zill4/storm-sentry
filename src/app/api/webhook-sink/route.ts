import { NextResponse } from "next/server"

declare global {
  // eslint-disable-next-line no-var
  var __stormSentrySink:
    | { received: Array<{ at: string; headers: Record<string, string>; body: unknown }> }
    | undefined
}

function getSink() {
  if (!globalThis.__stormSentrySink) globalThis.__stormSentrySink = { received: [] }
  return globalThis.__stormSentrySink
}

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const sink = getSink()
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    headers[k] = v
  })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = await req.text().catch(() => null)
  }
  sink.received.unshift({ at: new Date().toISOString(), headers, body })
  if (sink.received.length > 50) sink.received.length = 50
  return NextResponse.json({ ok: true })
}

export function GET() {
  const sink = getSink()
  return NextResponse.json({ count: sink.received.length, received: sink.received })
}

export function DELETE() {
  const sink = getSink()
  sink.received.length = 0
  return NextResponse.json({ ok: true })
}
