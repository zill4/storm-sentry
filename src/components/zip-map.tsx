"use client"

import { useState } from "react"

import { StormMap } from "@/components/storm-map"
import type { StormEvent } from "@/lib/storms/types"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"

/**
 * The /zip/{zip} report's embedded map: camera locked onto the ZIP centroid
 * with a pulsing pin, nearby storm polygons + live radar for context.
 * Cooperative gestures so touch-scrolling past the card doesn't pan the map.
 */
export function ZipMap({
  zip,
  lat,
  lng,
  storms,
  insights,
}: {
  zip: string
  lat: number
  lng: number
  storms: StormEvent[]
  insights: ZipInsightEvent[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <StormMap
      storms={storms}
      zipInsights={insights}
      selectedId={selectedId}
      onSelect={setSelectedId}
      showRadar
      initialView={{ longitude: lng, latitude: lat, zoom: 7.6 }}
      focusPoint={{ lat, lng, label: `ZIP ${zip}` }}
      showLegend={false}
      cooperativeGestures
    />
  )
}
