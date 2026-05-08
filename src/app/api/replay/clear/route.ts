import { NextResponse } from "next/server"
import { clearFixtureStorms } from "@/lib/storms/fixtures"

export const dynamic = "force-dynamic"

export async function POST() {
  const removed = clearFixtureStorms()
  return NextResponse.json({ ok: true, removed })
}

export async function GET() {
  const removed = clearFixtureStorms()
  return NextResponse.json({ ok: true, removed })
}
