"use client"

import { useEffect } from "react"

// One POST per landing even when React re-runs the effect (dev StrictMode
// double-mounts; client-side nav re-mounts don't re-land).
let postedHref: string | null = null

// Fire-and-forget landing beacon (see /api/visit). Posts when the URL carries
// an alert-link token (?sv=…) and otherwise once per browser session, so we
// learn how visitors reach the site without any third-party analytics.
export function VisitBeacon() {
  useEffect(() => {
    if (postedHref === window.location.href) return
    postedHref = window.location.href
    const url = new URL(window.location.href)
    const sv = url.searchParams.get("sv")
    const seenKey = "ss-visit-recorded"
    if (!sv && sessionStorage.getItem(seenKey)) return
    sessionStorage.setItem(seenKey, "1")
    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(sv ? { sv } : {}),
        path: url.pathname,
        ...(document.referrer ? { referrer: document.referrer } : {}),
      }),
      keepalive: true,
    }).catch(() => {
      /* beacon is best-effort */
    })
  }, [])
  return null
}
