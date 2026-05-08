import { NextResponse } from "next/server"
import { runOnePoll } from "@/lib/storms/poller"

export const dynamic = "force-dynamic"

export async function POST() {
  const result = await runOnePoll()
  return NextResponse.json(result)
}

export async function GET() {
  const result = await runOnePoll()
  return NextResponse.json(result)
}
