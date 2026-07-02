import * as THREE from "three"
import { MercatorCoordinate } from "maplibre-gl"
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl"

import { severityHex } from "@/lib/storms/severity"
import type { StormEvent } from "@/lib/storms/types"

export type StormThreeLayer = CustomLayerInterface & {
  setStorms: (storms: StormEvent[]) => void
  setSelectedId: (id: string | null) => void
}

const SIZE_SCRATCH = new THREE.Vector2()

const RINGS_PER_MARKER = 3
// Geographic footprint of a marker, in meters. Selected markers ping wider.
const RING_RADIUS_METERS = 130_000
const SELECTED_RING_RADIUS_METERS = 220_000
const CORE_RADIUS_METERS = 28_000
const PULSE_PERIOD_MS = 2600
const SELECTED_PULSE_PERIOD_MS = 1500

type Marker = {
  group: THREE.Group
  rings: THREE.Mesh[]
  core: THREE.Mesh
  ringMat: THREE.MeshBasicMaterial
  coreMat: THREE.MeshBasicMaterial
  selected: boolean
}

/** Average of every coordinate in a Polygon / MultiPolygon, as [lng, lat]. */
function centroid(geometry: StormEvent["geometry"]): [number, number] | null {
  if (!geometry) return null
  let sumLng = 0
  let sumLat = 0
  let n = 0
  const visit = (coords: number[][][]) => {
    for (const ring of coords) {
      for (const [lng, lat] of ring) {
        sumLng += lng
        sumLat += lat
        n++
      }
    }
  }
  if (geometry.type === "Polygon") visit(geometry.coordinates)
  else if (geometry.type === "MultiPolygon")
    for (const poly of geometry.coordinates) visit(poly)
  if (n === 0) return null
  return [sumLng / n, sumLat / n]
}

export function createStormThreeLayer(): StormThreeLayer {
  let map: MapLibreMap | null = null
  let renderer: THREE.WebGLRenderer | null = null
  const scene = new THREE.Scene()
  const camera = new THREE.Camera()

  const markers = new Map<string, Marker>()
  let storms: StormEvent[] = []
  let selectedId: string | null = null
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now()

  // Unit geometries (radius 1), scaled per-frame to a metric size.
  const ringGeo = new THREE.RingGeometry(0.82, 1, 56)
  const coreGeo = new THREE.CircleGeometry(1, 40)

  function buildMarker(storm: StormEvent, center: [number, number]): Marker {
    const color = new THREE.Color(severityHex(storm.severity))
    const merc = MercatorCoordinate.fromLngLat(center, 0)
    const metersToMerc = merc.meterInMercatorCoordinateUnits()

    const group = new THREE.Group()
    group.position.set(merc.x, merc.y, merc.z)
    // Mercator's Y axis points south; flip so geometry sits flat & upright.
    group.scale.set(metersToMerc, -metersToMerc, metersToMerc)

    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const rings: THREE.Mesh[] = []
    for (let i = 0; i < RINGS_PER_MARKER; i++) {
      const mesh = new THREE.Mesh(ringGeo, ringMat)
      mesh.renderOrder = 1
      rings.push(mesh)
      group.add(mesh)
    }

    const coreMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.renderOrder = 2
    group.add(core)

    return {
      group,
      rings,
      core,
      ringMat,
      coreMat,
      selected: storm.id === selectedId,
    }
  }

  function disposeMarker(marker: Marker) {
    scene.remove(marker.group)
    marker.ringMat.dispose()
    marker.coreMat.dispose()
  }

  function rebuild() {
    const seen = new Set<string>()
    for (const storm of storms) {
      const center = centroid(storm.geometry)
      if (!center) continue
      seen.add(storm.id)
      const existing = markers.get(storm.id)
      if (existing) disposeMarker(existing)
      const marker = buildMarker(storm, center)
      markers.set(storm.id, marker)
      scene.add(marker.group)
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        disposeMarker(marker)
        markers.delete(id)
      }
    }
    map?.triggerRepaint()
  }

  function animate(elapsed: number) {
    for (const marker of markers.values()) {
      const period = marker.selected
        ? SELECTED_PULSE_PERIOD_MS
        : PULSE_PERIOD_MS
      const maxRadius = marker.selected
        ? SELECTED_RING_RADIUS_METERS
        : RING_RADIUS_METERS

      marker.rings.forEach((ring, i) => {
        const phase = ((elapsed / period + i / RINGS_PER_MARKER) % 1 + 1) % 1
        const radius = THREE.MathUtils.lerp(
          CORE_RADIUS_METERS,
          maxRadius,
          phase,
        )
        ring.scale.setScalar(radius)
        const mat = ring.material as THREE.MeshBasicMaterial
        mat.opacity = (1 - phase) * (marker.selected ? 0.85 : 0.6)
      })

      const breathe = 0.85 + 0.15 * Math.sin((elapsed / period) * Math.PI * 2)
      marker.core.scale.setScalar(
        CORE_RADIUS_METERS * breathe * (marker.selected ? 1.5 : 1),
      )
      marker.coreMat.opacity = marker.selected ? 1 : 0.85
    }
  }

  return {
    id: "storm-three",
    type: "custom",
    renderingMode: "3d",

    onAdd(addedMap: MapLibreMap, gl: WebGL2RenderingContext | WebGLRenderingContext) {
      map = addedMap
      renderer = new THREE.WebGLRenderer({
        canvas: addedMap.getCanvas(),
        context: gl,
        antialias: true,
      })
      renderer.autoClear = false
      rebuild()
    },

    onRemove() {
      for (const marker of markers.values()) disposeMarker(marker)
      markers.clear()
      ringGeo.dispose()
      coreGeo.dispose()
      renderer?.dispose()
      renderer = null
      map = null
    },

    render(_gl, options: CustomRenderMethodInput) {
      if (!renderer) return
      const elapsed =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        startedAt
      animate(elapsed)

      camera.projectionMatrix = new THREE.Matrix4().fromArray(
        options.modelViewProjectionMatrix as unknown as number[],
      )
      renderer.resetState()
      // Keep three's cached size in lockstep with the (resizable) map canvas —
      // otherwise three re-applies a stale gl.viewport every frame after a
      // container resize, clipping everything maplibre draws afterwards.
      const canvas = renderer.domElement
      const size = renderer.getSize(SIZE_SCRATCH)
      if (size.x !== canvas.width || size.y !== canvas.height) {
        renderer.setSize(canvas.width, canvas.height, false)
      }
      renderer.render(scene, camera)
      map?.triggerRepaint()
    },

    setStorms(next: StormEvent[]) {
      storms = next
      // Build only after the GL context exists (onAdd ran).
      if (renderer) rebuild()
    },

    setSelectedId(id: string | null) {
      selectedId = id
      for (const [markerId, marker] of markers) {
        marker.selected = markerId === id
      }
      map?.triggerRepaint()
    },
  }
}
