"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Layer, Map, NavigationControl, Popup, Source } from "react-map-gl/maplibre"
import type { MapRef } from "react-map-gl/maplibre"
import type { StyleSpecification } from "maplibre-gl"
import { centroid } from "@turf/turf"
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
  /** Bumped (seq) by list clicks only, so map clicks never trigger a fly. */
  flyTo?: { id: string; seq: number } | null
  /** Storms filtered out elsewhere render dimmed instead of disappearing. */
  dimmedIds?: Set<string> | string[]
}

type HoverInfo =
  | {
      kind: "storm"
      lng: number
      lat: number
      eventType: string
      severity: string
      areaDesc: string
    }
  | { kind: "zip"; lng: number; lat: number; zip: string; gust: number | null }

// Light basemap from CARTO's public raster tiles — no API key required.
const LIGHT_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#EDEAE3" } },
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
  flyTo,
  dimmedIds,
}: Props) {
  const radarTiles = useRadarTiles(showRadar)
  const mapRef = useRef<MapRef | null>(null)
  const layerRef = useRef<StormThreeLayer | null>(null)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [dragging, setDragging] = useState(false)
  const lastFlySeq = useRef(0)

  const dimmed = useMemo(() => {
    if (!dimmedIds) return new Set<string>()
    return dimmedIds instanceof Set ? dimmedIds : new Set(dimmedIds)
  }, [dimmedIds])

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

  // Fly to a storm's centroid when a list click bumps flyTo.seq.
  useEffect(() => {
    if (!flyTo || flyTo.seq === lastFlySeq.current) return
    lastFlySeq.current = flyTo.seq
    const map = mapRef.current?.getMap()
    const storm = storms.find((s) => s.id === flyTo.id)
    if (!map || !storm?.geometry) return
    const [lng, lat] = centroid(storm.geometry).geometry.coordinates
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 5.5),
      duration: 900,
    })
  }, [flyTo, storms])

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
        dimmed: dimmed.has(s.id) ? 1 : 0,
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
          zip: z.zip,
          gust: z.nowcast?.windGust ?? null,
        },
      })),
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        onLoad={handleLoad}
        initialViewState={{ longitude: -96, latitude: 38.5, zoom: 3.5 }}
        mapStyle={LIGHT_STYLE}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["storm-fill", "zip-dots"]}
        onClick={(e) => {
          const f = e.features?.find((ft) => ft.layer.id === "storm-fill")
          if (f && f.properties && onSelect) {
            onSelect(String(f.properties.id))
          } else if (onSelect) {
            onSelect(null)
          }
        }}
        onMouseMove={(e) => {
          if (dragging) return
          const f = e.features?.[0]
          if (!f?.properties) {
            setHover(null)
            return
          }
          if (f.layer.id === "zip-dots") {
            setHover({
              kind: "zip",
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
              zip: String(f.properties.zip ?? ""),
              gust:
                typeof f.properties.gust === "number" ? f.properties.gust : null,
            })
          } else {
            setHover({
              kind: "storm",
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
              eventType: String(f.properties.eventType ?? ""),
              severity: String(f.properties.severity ?? "Unknown"),
              areaDesc: String(f.properties.areaDesc ?? ""),
            })
          }
        }}
        onMouseLeave={() => setHover(null)}
        onDragStart={() => {
          setDragging(true)
          setHover(null)
        }}
        onDragEnd={() => setDragging(false)}
        cursor={hover ? "pointer" : "default"}
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
            <Layer id="radar-layer" type="raster" paint={{ "raster-opacity": 0.6 }} />
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
              "line-opacity": [
                "case",
                ["==", ["get", "dimmed"], 1],
                0.1,
                0.65,
              ],
            }}
          />
          <Layer
            id="storm-fill"
            type="fill"
            paint={{
              "fill-color": ["get", "color"],
              "fill-opacity": [
                "case",
                ["==", ["get", "selected"], 1],
                0.55,
                ["==", ["get", "dimmed"], 1],
                0.08,
                0.3,
              ],
            }}
          />
          <Layer
            id="storm-outline"
            type="line"
            paint={{
              "line-color": ["get", "color"],
              "line-width": ["case", ["==", ["get", "selected"], 1], 2.5, 1.4],
              "line-opacity": [
                "case",
                ["==", ["get", "dimmed"], 1],
                0.15,
                1,
              ],
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

        {hover && !dragging && (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            closeButton={false}
            closeOnClick={false}
            offset={12}
            maxWidth="260px"
            className="storm-popup"
          >
            <div className="rounded-xl border border-[#DDD8CC] bg-[#F7F5F0] px-3 py-2 text-[#201E1A] shadow-md">
              {hover.kind === "storm" ? (
                <>
                  <div className="text-sm font-semibold">{hover.eventType}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6F6A5F]">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: severityHex(hover.severity) }}
                    />
                    {hover.severity}
                  </div>
                  {hover.areaDesc && (
                    <div className="mt-1 line-clamp-2 text-xs text-[#6F6A5F]">
                      {hover.areaDesc}
                    </div>
                  )}
                </>
              ) : (
                <div className="font-mono text-xs font-semibold tabular-nums">
                  ZIP {hover.zip}
                  {hover.gust != null
                    ? ` · ${Math.round(hover.gust)} mph gust`
                    : ""}
                </div>
              )}
            </div>
          </Popup>
        )}
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
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border border-[#DDD8CC] bg-[#F7F5F0]/95 px-3 py-2.5 text-[11px] text-[#201E1A] shadow-sm">
      <div className="mb-1.5 uppercase tracking-[0.08em] text-[#6F6A5F]">
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
      <div className="mt-2 flex items-center gap-2 border-t border-[#DDD8CC] pt-2">
        <span className="size-2.5 rounded-full bg-[#9B958A] ring-1 ring-white" />
        ZIP · nowcast
      </div>
    </div>
  )
}
