import { NextResponse, type NextRequest } from "next/server"

// Storm Sentry's pages now live at smarttarpsolutions.com/storms/*. This app
// stays deployed because it owns the write side (poller, alert gate, webhook
// dispatcher, GHL notifier) and still answers the API — but every human-facing
// route forwards to the umbrella.
//
// /zip/{zip} matters most: alert messages already sent to CRM contacts carry
// stormsentryai.com/zip/{zip}?sv=<token> links that are out in the world and
// cannot be recalled. The query string is preserved so the referral token
// survives the hop and the umbrella can still attribute the visit.
//
// 307 (not 301) so nothing caches the mapping permanently while the two
// deployments are still being untangled.
const SOLUTIONS = (process.env.SOLUTIONS_BASE_URL ?? "https://smarttarpsolutions.com").replace(
  /\/+$/,
  "",
)

const PAGE_REDIRECTS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^\/$/, () => "/storms"],
  [/^\/reports\/?$/, () => "/storms/reports"],
  [/^\/forecast\/?$/, () => "/storms/forecast"],
  [/^\/zip\/([^/]+)\/?$/, (m) => `/storms/zip/${m[1]}`],
  [/^\/account\/?$/, () => "/account"],
  [/^\/sign-in\/?$/, () => "/sign-in"],
  [/^\/sign-up\/?$/, () => "/sign-up"],
]

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Machines keep talking to this deployment: Zapier catch-hooks registered
  // against /api/webhooks, the zip-insights export, the forecast endpoint the
  // umbrella proxies to, and Better Auth. Never redirect these.
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next()
  }

  for (const [pattern, to] of PAGE_REDIRECTS) {
    const m = pathname.match(pattern)
    if (m) return NextResponse.redirect(`${SOLUTIONS}${to(m)}${search}`, 307)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
}
