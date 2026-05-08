"use client"

import { useEffect, useRef } from "react"

import type { BusEvent } from "@/lib/bus"

const ALL_TYPES = [
  "hello",
  "storm_added",
  "storm_updated",
  "storm_removed",
  "match_created",
  "matches_pruned",
  "fixtures_cleared",
  "poll_completed",
] as const

export function useLiveEvents(onEvent: (event: BusEvent | { type: "hello"; at: string }) => void) {
  // Always read the latest callback without re-subscribing on every render.
  const cbRef = useRef(onEvent)
  cbRef.current = onEvent

  useEffect(() => {
    const es = new EventSource("/api/events")
    const handler = (msg: MessageEvent) => {
      try {
        const data = JSON.parse(msg.data)
        cbRef.current(data)
      } catch {
        /* skip malformed */
      }
    }
    for (const t of ALL_TYPES) {
      es.addEventListener(t, handler)
    }
    return () => {
      for (const t of ALL_TYPES) {
        es.removeEventListener(t, handler)
      }
      es.close()
    }
  }, [])
}
