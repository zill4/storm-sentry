"use client"

import { Layer, Map, NavigationControl, Source } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

import type { StormEvent } from "@/lib/storms/types"
import { severityHex } from "@/lib/storms/severity"

type Props = {
  storms: StormEvent[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}

export function StormMap({ storms, selectedId, onSelect }: Props) {
  const features = storms
    .filter((s) => s.geometry)
    .map((s) => ({
      type: "Feature" as const,
      id: s.id,
      geometry: s.geometry!,
      properties: {
        id: s.id,
        severity: s.severity,
        eventType: s.eventType,
        areaDesc: s.areaDesc ?? "",
        color: severityHex(s.severity),
        selected: s.id === selectedId ? 1 : 0,
      },
    }))

  const geojson = {
    type: "FeatureCollection" as const,
    features,
  }

  return (
    <Map
      initialViewState={{ longitude: -96, latitude: 38.5, zoom: 3.5 }}
      mapStyle="https://demotiles.maplibre.org/style.json"
      style={{ width: "100%", height: 520 }}
      interactiveLayerIds={["storm-fill"]}
      onClick={(e) => {
        const f = e.features?.[0]
        if (f && f.properties && onSelect) {
          onSelect(String(f.properties.id))
        } else if (onSelect) {
          onSelect(null)
        }
      }}
      cursor="default"
    >
      <NavigationControl position="top-right" />
      <Source id="storms" type="geojson" data={geojson}>
        <Layer
          id="storm-fill"
          type="fill"
          paint={{
            "fill-color": ["get", "color"],
            "fill-opacity": [
              "case",
              ["==", ["get", "selected"], 1],
              0.7,
              0.4,
            ],
          }}
        />
        <Layer
          id="storm-outline"
          type="line"
          paint={{
            "line-color": ["get", "color"],
            "line-width": [
              "case",
              ["==", ["get", "selected"], 1],
              3,
              1.2,
            ],
          }}
        />
      </Source>
    </Map>
  )
}
