import type { StormEvent, StormMotion } from "./types"

// Minutes-to-arrival estimation.
//
// Primary source: the radar-derived motion vector NWS attaches to warned
// storms (parameters.eventMotionDescription, the CAP form of TIME...MOT...LOC):
//   "2026-07-02T01:48:00-00:00...storm...286DEG...39KT...42.77,-73.6 42.33,-74.61"
// fields are '...'-delimited: observation time, literal "storm", direction the
// cell is moving FROM (meteorological convention), speed in knots, then one
// lat,lng per radar-identified cell. We advance each cell along its track for
// the time elapsed since observation and project the remaining along-track
// distance to the target point.
//
// Fallback: alerts whose onset is still in the future (watches, approaching
// hurricanes) — ETA is simply onset minus now.

const KT_TO_MS = 0.514444
const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LNG_EQ = 111_320

/** Ignore cells whose path misses the target by more than this laterally. */
const MAX_CROSS_TRACK_M = 80_000
/** Motion extrapolation beyond this is weather fiction. */
const MAX_TRACK_ETA_MIN = 360
/** A cell that "arrived" this recently still counts as arriving now. */
const GRACE_PAST_MIN = 15
/** Onset-based ETAs beyond this aren't actionable for a storm email. */
const MAX_ONSET_ETA_MIN = 48 * 60

export function parseEventMotion(desc: string): StormMotion | null {
  const parts = desc.split("...").map((p) => p.trim()).filter(Boolean)
  if (parts.length < 4) return null

  const refTime = parts[0]
  if (Number.isNaN(new Date(refTime).getTime())) return null

  const degPart = parts.find((p) => /^\d{1,3}DEG$/i.test(p))
  const ktPart = parts.find((p) => /^\d{1,3}KT$/i.test(p))
  if (!degPart || !ktPart) return null
  const fromDeg = Number(degPart.replace(/deg/i, ""))
  const speedKt = Number(ktPart.replace(/kt/i, ""))
  if (!Number.isFinite(fromDeg) || !Number.isFinite(speedKt)) return null

  // Coordinates arrive as "lat,lng lat,lng …" in the final segment(s).
  const points: Array<{ lat: number; lng: number }> = []
  for (const part of parts) {
    for (const token of part.split(/\s+/)) {
      const m = token.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)
      if (!m) continue
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
      points.push({ lat, lng })
    }
  }
  if (points.length === 0) return null

  return {
    refTime,
    // Meteorological convention: 286DEG means moving FROM 286° → toward 106°.
    headingDeg: (fromDeg + 180) % 360,
    speedKt,
    points,
  }
}

export type EtaEstimate = {
  minutes: number
  source: "track" | "onset"
}

/** ETA of a moving cell to (lat,lng), or null when it can't be estimated. */
function trackEta(
  motion: StormMotion,
  lat: number,
  lng: number,
  nowMs: number,
): number | null {
  if (motion.speedKt < 3) return null // quasi-stationary; projection is noise
  const refMs = new Date(motion.refTime).getTime()
  if (Number.isNaN(refMs)) return null
  const elapsedS = Math.max(0, (nowMs - refMs) / 1000)
  if (elapsedS > 3 * 3600) return null // observation too stale to extrapolate

  const speedMs = motion.speedKt * KT_TO_MS
  const headingRad = (motion.headingDeg * Math.PI) / 180
  // Unit vector of travel in local ENU meters (x east, y north).
  const hx = Math.sin(headingRad)
  const hy = Math.cos(headingRad)

  let best: { absCross: number; etaMin: number } | null = null
  for (const p of motion.points) {
    const mPerDegLng =
      M_PER_DEG_LNG_EQ * Math.cos(((lat + p.lat) / 2) * (Math.PI / 180))
    // Cell position advanced to "now" along its track.
    const advanced = speedMs * elapsedS
    const cellX = p.lng * mPerDegLng + hx * advanced
    const cellY = p.lat * M_PER_DEG_LAT + hy * advanced
    const dx = lng * mPerDegLng - cellX
    const dy = lat * M_PER_DEG_LAT - cellY

    const along = dx * hx + dy * hy // meters until the cell reaches the target
    const cross = -dx * hy + dy * hx // lateral miss distance
    if (Math.abs(cross) > MAX_CROSS_TRACK_M) continue

    const etaMin = along / speedMs / 60
    if (best === null || Math.abs(cross) < best.absCross) {
      best = { absCross: Math.abs(cross), etaMin }
    }
  }
  if (!best) return null
  if (best.etaMin > MAX_TRACK_ETA_MIN) return null
  if (best.etaMin < -GRACE_PAST_MIN) return null // cell already passed
  return Math.max(0, Math.round(best.etaMin))
}

/**
 * Best-effort minutes-to-arrival for a storm at a point. Track projection when
 * the alert carries radar motion; future-onset delta otherwise; null when
 * neither applies (typical for warnings already in effect overhead).
 */
export function estimateEta(
  storm: Pick<StormEvent, "motion" | "startedAt">,
  lat: number,
  lng: number,
  now: Date = new Date(),
): EtaEstimate | null {
  if (storm.motion) {
    const minutes = trackEta(storm.motion, lat, lng, now.getTime())
    if (minutes !== null) return { minutes, source: "track" }
  }

  if (storm.startedAt) {
    const onsetMs = new Date(storm.startedAt).getTime()
    if (!Number.isNaN(onsetMs)) {
      const minutes = Math.round((onsetMs - now.getTime()) / 60_000)
      if (minutes > 0 && minutes <= MAX_ONSET_ETA_MIN) {
        return { minutes, source: "onset" }
      }
    }
  }

  return null
}

/** "arriving now" / "~40 minutes" / "~1.5 hours" — merge-field friendly. */
export function formatEta(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null
  if (minutes <= 5) return "arriving now"
  if (minutes < 90) return `~${Math.round(minutes / 5) * 5} minutes`
  const hours = minutes / 60
  const rounded = Math.round(hours * 2) / 2 // half-hour steps
  return rounded === Math.floor(rounded)
    ? `~${rounded} hour${rounded === 1 ? "" : "s"}`
    : `~${rounded} hours`
}
