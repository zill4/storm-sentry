"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Re-fetches the current server component tree on an interval — keeps the
 *  public storm report live without any client data plumbing. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
