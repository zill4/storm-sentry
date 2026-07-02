import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Clock, Droplets, MapPin, Thermometer, Wind } from "lucide-react"

import { AutoRefresh } from "@/components/auto-refresh"
import { ZipMap } from "@/components/zip-map"
import { estimateEta, formatEta } from "@/lib/storms/eta"
import { severityBadgeClass, severityHex } from "@/lib/storms/severity"
import { listActiveStorms } from "@/lib/storms/store"
import { severityRank, type StormEvent } from "@/lib/storms/types"
import { getCachedNowcast } from "@/lib/tomorrow/nowcast"
import { listZipInsights } from "@/lib/zip-insights/store"
import { getZip } from "@/lib/zips/store"

export const dynamic = "force-dynamic"

// Public, no-auth storm report for one ZIP — the landing page for links sent
// by the GHL / Zapier automations (…/zip/75201). Reads only in-memory stores
// and the nowcast cache: a page view never spends Tomorrow.io budget.

type Params = { zip: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { zip } = await params
  return {
    title: `ZIP ${zip} storm report — Storm Sentry`,
    description: `Live severe-weather alerts, storm arrival estimates, and conditions for ZIP ${zip}, powered by Storm Sentry.`,
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Rough geometry centroid (mean of ring coords) — good enough for a
 *  "is this storm near the ZIP?" prefilter. */
function roughCentroid(geometry: NonNullable<StormEvent["geometry"]>): [number, number] {
  let lng = 0
  let lat = 0
  let n = 0
  const visit = (rings: number[][][]) => {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        lng += x
        lat += y
        n++
      }
    }
  }
  if (geometry.type === "Polygon") visit(geometry.coordinates)
  else for (const poly of geometry.coordinates) visit(poly)
  return n === 0 ? [0, 0] : [lng / n, lat / n]
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Storms worth drawing on the ZIP-focused map: everything threatening this
 *  ZIP plus context storms within ~250 km, capped so a lead on a phone never
 *  downloads the whole CONUS alert set. */
function nearbyStorms(
  all: StormEvent[],
  threatIds: Set<string>,
  lat: number,
  lng: number,
  cap = 40,
): StormEvent[] {
  return all
    .filter((s) => s.geometry)
    .map((s) => {
      const [cLng, cLat] = roughCentroid(s.geometry!)
      return { storm: s, km: distanceKm(lat, lng, cLat, cLng) }
    })
    .filter(({ storm, km }) => threatIds.has(storm.id) || km <= 250)
    .sort((a, b) => {
      const at = a.storm.id
      const bt = b.storm.id
      const aThreat = threatIds.has(at) ? 0 : 1
      const bThreat = threatIds.has(bt) ? 0 : 1
      if (aThreat !== bThreat) return aThreat - bThreat
      return a.km - b.km
    })
    .slice(0, cap)
    .map(({ storm }) => storm)
}

export default async function ZipReportPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { zip } = await params
  if (!/^\d{5}$/.test(zip)) notFound()
  const centroid = getZip(zip)
  if (!centroid) notFound()

  const now = new Date()
  const stormsById = new Map<string, StormEvent>(
    listActiveStorms().map((s) => [s.id, s]),
  )

  // One card per active storm threatening this ZIP, worst first, soonest first.
  const threats = listZipInsights()
    .filter((i) => i.zip === zip)
    .map((i) => {
      const storm = stormsById.get(i.stormId)
      // Recompute at render time so the countdown decays between polls.
      const eta = storm
        ? estimateEta(storm, centroid.lat, centroid.lng, now)
        : i.etaMinutes != null && i.etaSource != null
          ? { minutes: i.etaMinutes, source: i.etaSource }
          : null
      return { insight: i, storm, eta }
    })
    .sort((a, b) => {
      const sev = severityRank(b.insight.severity) - severityRank(a.insight.severity)
      if (sev !== 0) return sev
      return (a.eta?.minutes ?? Infinity) - (b.eta?.minutes ?? Infinity)
    })

  const nowcast = getCachedNowcast(zip)

  // Map payload: this ZIP's threats + context storms within ~250 km.
  const threatIds = new Set(threats.map((t) => t.insight.stormId))
  const mapStorms = nearbyStorms(
    [...stormsById.values()],
    threatIds,
    centroid.lat,
    centroid.lng,
  )
  const mapInsights = threats.map((t) => t.insight)

  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <AutoRefresh seconds={60} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
            Live storm report
          </span>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            ZIP {zip}
          </h1>
          <p className="text-sm leading-6 text-[#5A6B7E]">
            Live National Weather Service alerts for this area, with storm
            arrival estimates from radar-tracked cell motion. Updated{" "}
            {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{" "}
            · refreshes automatically.
          </p>
        </header>

        {/* Live radar view locked onto this ZIP. */}
        <section className="overflow-hidden rounded-2xl border border-[#D7E0EA] bg-white shadow-sm">
          <div className="h-[300px] sm:h-[420px]">
            <ZipMap
              zip={zip}
              lat={centroid.lat}
              lng={centroid.lng}
              storms={mapStorms}
              insights={mapInsights}
            />
          </div>
        </section>

        {threats.length === 0 ? (
          <div className="rounded-2xl border border-[#D7E0EA] bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#2FA37A]/12">
              <MapPin className="size-5 text-[#2FA37A]" />
            </div>
            <h2 className="mt-3 text-base font-semibold">
              No active severe weather for {zip}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#5A6B7E]">
              There are no National Weather Service alerts covering this ZIP
              right now. This page updates the moment that changes.
            </p>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            {threats.map(({ insight, storm, eta }) => (
              <article
                key={insight.id}
                className="rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ring-1 ${severityBadgeClass(insight.severity)}`}
                  >
                    {insight.severity}
                  </span>
                  <h2 className="text-base font-semibold text-[#0B2037]">
                    {insight.eventType}
                  </h2>
                  {eta && (
                    <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#F47A20]/12 px-2.5 py-1 text-xs font-semibold text-[#B85614]">
                      <Clock className="size-3.5" />
                      {eta.minutes <= 5
                        ? "Arriving now"
                        : `Est. arrival ${formatEta(eta.minutes)}`}
                    </span>
                  )}
                </div>
                {insight.headline && (
                  <p className="mt-2 text-sm leading-6 text-[#5A6B7E]">
                    {insight.headline}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8B98A8]">
                  <span className="tabular-nums">
                    In effect until {formatTime(insight.expiresAt)}
                  </span>
                  {storm?.senderName && <span>{storm.senderName}</span>}
                  <span
                    className="ml-auto size-2 rounded-full"
                    style={{ backgroundColor: severityHex(insight.severity) }}
                    aria-hidden
                  />
                </div>
              </article>
            ))}
          </section>
        )}

        {nowcast && (
          <section className="rounded-2xl border border-[#D7E0EA] bg-white p-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[#5A6B7E]">
              Current conditions
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {nowcast.temperature != null && (
                <div className="flex items-center gap-2.5">
                  <Thermometer className="size-4 shrink-0 text-[#1FA6E5]" />
                  <div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {Math.round(nowcast.temperature)}°F
                    </div>
                    <div className="text-[11px] text-[#8B98A8]">Temperature</div>
                  </div>
                </div>
              )}
              {nowcast.windGust != null && (
                <div className="flex items-center gap-2.5">
                  <Wind className="size-4 shrink-0 text-[#1FA6E5]" />
                  <div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {Math.round(nowcast.windGust)} mph
                    </div>
                    <div className="text-[11px] text-[#8B98A8]">Wind gusts</div>
                  </div>
                </div>
              )}
              {nowcast.precipIntensity != null && (
                <div className="flex items-center gap-2.5">
                  <Droplets className="size-4 shrink-0 text-[#1FA6E5]" />
                  <div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {nowcast.precipIntensity.toFixed(2)} in/hr
                    </div>
                    <div className="text-[11px] text-[#8B98A8]">Precipitation</div>
                  </div>
                </div>
              )}
              {nowcast.weatherLabel && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="size-4 shrink-0 text-[#1FA6E5]" />
                  <div>
                    <div className="text-lg font-semibold">{nowcast.weatherLabel}</div>
                    <div className="text-[11px] text-[#8B98A8]">Conditions</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* The one loud navy moment: convert the email click into an account. */}
        <section className="rounded-2xl border border-[#103153] bg-[#0B2037] p-6 text-white shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
            Storm Sentry
          </div>
          <h2 className="font-display mt-2 text-2xl font-bold tracking-tight">
            Know before the storm hits
          </h2>
          <p className="mt-1.5 max-w-lg text-sm leading-6 text-[#91A8BF]">
            Storm Sentry tracks every severe-weather cell in the country and
            resolves it to the ZIP code — with arrival estimates, live radar,
            and alerts for the areas you care about.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1FA6E5] px-4 py-2 text-sm font-semibold text-[#06121F] transition hover:bg-[#1FA6E5]/90"
            >
              Create your free account
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-white/80 transition hover:text-white"
            >
              View the live storm map →
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
