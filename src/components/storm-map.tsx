"use client"

import { useEffect, useRef, useState } from "react"
import { Layer, Map, NavigationControl, Source } from "react-map-gl/maplibre"
import type { MapRef } from "react-map-gl/maplibre"
import type { StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import type { StormEvent } from "@/lib/storms/types"
import { severityHex, SEVERITY_HEX } from "@/lib/storms/severity"
import type { ZipInsightEvent } from "@/lib/zip-insights/types"
import {
  createStormThreeLayer,
  type StormThreeLayer,
} from "@/components/storm-three-layer"

type Props = {
  storms: StormEvent[]
  zipInsights?: ZipInsightEvent[]
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  showRadar?: boolean
}

// Dark basemap from CARTO's public raster tiles — no API key required.
const DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#070b16" } },
    { id: "carto", type: "raster", source: "carto" },
  ],
}

// Latest live precipitation-radar frame from RainViewer's free public API.
// (Tomorrow.io map tiles are intentionally NOT used here: each tile is a
// metered API call and would exhaust the free daily budget in one map view.)
function useRadarTiles(enabled: boolean): string[] | null {
  const [tiles, setTiles] = useState<string[] | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          "https://api.rainviewer.com/public/weather-maps.json",
          { cache: "no-store" },
        )
        if (!res.ok) return
        const data = (await res.json()) as {
          host: string
          radar?: { past?: { time: number; path: string }[] }
        }
        const frames = data.radar?.past ?? []
        const latest = frames[frames.length - 1]
        if (!latest || cancelled) return
        // size / z / x / y / color(2 = universal blue) / smooth_snow
        setTiles([`${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`])
      } catch {
        /* radar is best-effort; ignore network errors */
      }
    }

    void load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled])

  return tiles
}

export function StormMap({
  storms,
  zipInsights = [],
  selectedId,
  onSelect,
  showRadar = true,
}: Props) {
  const radarTiles = useRadarTiles(showRadar)
  const mapRef = useRef<MapRef | null>(null)
  const layerRef = useRef<StormThreeLayer | null>(null)

  // Add the three.js storm layer once the map's GL context is ready.
  function handleLoad() {
    const map = mapRef.current?.getMap()
    if (!map || layerRef.current) return
    const layer = createStormThreeLayer()
    layerRef.current = layer
    map.addLayer(layer)
    layer.setStorms(storms)
    layer.setSelectedId(selectedId ?? null)
  }

  // Push live storm + selection changes into the three.js layer.
  useEffect(() => {
    layerRef.current?.setStorms(storms)
  }, [storms])

  useEffect(() => {
    layerRef.current?.setSelectedId(selectedId ?? null)
  }, [selectedId])

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

  // Threatened-ZIP centroids — the storm×ZIP intersection rendered as a
  // fine-grained speckle inside each storm footprint. Enriched ZIPs (with a
  // Tomorrow.io nowcast) get a white ring so they stand out.
  const zipGeojson = {
    type: "FeatureCollection" as const,
    features: zipInsights
      .filter((z) => Number.isFinite(z.lat) && Number.isFinite(z.lng))
      .map((z) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [z.lng, z.lat] },
        properties: {
          color: severityHex(z.severity),
          enriched: z.nowcast ? 1 : 0,
        },
      })),
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        onLoad={handleLoad}
        initialViewState={{ longitude: -96, latitude: 38.5, zoom: 3.5 }}
        mapStyle={DARK_STYLE}
        style={{ width: "100%", height: "100%" }}
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

        {showRadar && radarTiles && (
          <Source
            id="radar"
            type="raster"
            tiles={radarTiles}
            tileSize={256}
            maxzoom={7}
            attribution="Radar © RainViewer"
          >
            <Layer id="radar-layer" type="raster" paint={{ "raster-opacity": 0.7 }} />
          </Source>
        )}

        <Source id="storms" type="geojson" data={geojson}>
          {/* Soft outer halo to give each storm a glowing footprint. */}
          <Layer
            id="storm-glow"
            type="line"
            paint={{
              "line-color": ["get", "color"],
              "line-blur": 12,
              "line-width": ["case", ["==", ["get", "selected"], 1], 18, 12],
              "line-opacity": 0.65,
            }}
          />
          <Layer
            id="storm-fill"
            type="fill"
            paint={{
              "fill-color": ["get", "color"],
              "fill-opacity": ["case", ["==", ["get", "selected"], 1], 0.55, 0.3],
            }}
          />
          <Layer
            id="storm-outline"
            type="line"
            paint={{
              "line-color": ["get", "color"],
              "line-width": ["case", ["==", ["get", "selected"], 1], 2.5, 1.4],
            }}
          />
        </Source>

        <Source id="zip-insights" type="geojson" data={zipGeojson}>
          <Layer
            id="zip-dots"
            type="circle"
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                1.6,
                6,
                3,
                9,
                5,
              ],
              "circle-opacity": 0.6,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": ["case", ["==", ["get", "enriched"], 1], 1.1, 0],
              "circle-stroke-opacity": 0.75,
            }}
          />
        </Source>
      </Map>

      <MapLegend />
    </div>
  )
}

const LEGEND_SEVERITIES: Array<{ label: string; key: keyof typeof SEVERITY_HEX }> = [
  { label: "Extreme", key: "Extreme" },
  { label: "Severe", key: "Severe" },
  { label: "Moderate", key: "Moderate" },
  { label: "Minor", key: "Minor" },
]

function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-white/10 bg-[#070b16]/80 px-3 py-2.5 text-[11px] text-zinc-300 backdrop-blur">
      <div className="mb-1.5 font-medium uppercase tracking-wide text-zinc-400">
        Severity
      </div>
      <div className="flex flex-col gap-1">
        {LEGEND_SEVERITIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: SEVERITY_HEX[s.key] }}
            />
            {s.label}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
        <span className="size-2.5 rounded-full bg-zinc-300 ring-1 ring-white" />
        ZIP · nowcast
      </div>
    </div>
  )
}
