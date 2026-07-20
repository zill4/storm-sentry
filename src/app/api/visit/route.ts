import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { recordVisit, VISIT_COOKIE } from "@/lib/referrals/store"

export const dynamic = "force-dynamic"

// Landing beacon. The client posts once per page landing (always when the URL
// carries ?sv=, else once per browser session) and we record how the visitor
// arrived. A valid alert-link token also sets a long-lived httpOnly cookie so
// later sign-up can prefill and attribute the account. Cookie writes must
// happen here (a Route Handler) — Server Components can't set cookies.
const Body = z.object({
  sv: z.string().min(8).max(64).optional(),
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    raw = {}
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const info = await recordVisit({
    sv: parsed.data.sv ?? null,
    path: parsed.data.path,
    referrer: parsed.data.referrer ?? null,
    userAgent: req.headers.get("user-agent"),
  })

  if (info) {
    const store = await cookies()
    store.set(VISIT_COOKIE, info.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
    })
  }
  return NextResponse.json({ ok: true, known: Boolean(info) })
}
