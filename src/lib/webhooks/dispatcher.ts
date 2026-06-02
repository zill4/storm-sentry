import { type BusEvent, subscribe } from "@/lib/bus"
import { listWebhooks, recordDelivery, type WebhookSubscription } from "./store"

declare global {
  // eslint-disable-next-line no-var
  var __stormSentryWebhookDispatcher: { unsubscribe: () => void } | undefined
}

function buildPayload(event: Extract<BusEvent, { type: "match_created" }>) {
  const distanceMiles = event.match.distanceMeters / 1609.344
  return {
    event_type: "storm_sentry.match.v1",
    fired_at: event.at,
    idempotency_key: event.match.id,
    business: {
      id: event.business.id,
      name: event.business.name,
      city: event.business.city,
      state: event.business.state,
      lat: event.business.lat,
      lng: event.business.lng,
      phone: event.business.phone,
      email: event.business.email,
      timezone: event.business.timezone,
    },
    storm: {
      id: event.storm.id,
      source: event.storm.source,
      source_event_id: event.storm.sourceEventId,
      event_type: event.storm.eventType,
      severity: event.storm.severity,
      headline: event.storm.headline,
      area_desc: event.storm.areaDesc,
      started_at: event.storm.startedAt,
      expires_at: event.storm.expiresAt,
      nws_url: event.storm.nwsUrl,
      distance_meters: event.match.distanceMeters,
      distance_miles: Number(distanceMiles.toFixed(2)),
    },
    match: {
      id: event.match.id,
      created_at: event.match.createdAt,
      distance_meters: event.match.distanceMeters,
    },
  }
}

function buildZipInsightPayload(
  event: Extract<BusEvent, { type: "zip_insight_added" }>,
) {
  const i = event.insight
  const distanceMiles = i.distanceMeters / 1609.344
  return {
    event_type: "storm_sentry.zip_insight.v1",
    fired_at: event.at,
    idempotency_key: i.id,
    zip: { code: i.zip, lat: i.lat, lng: i.lng },
    storm: {
      id: i.stormId,
      source: i.source,
      event_type: i.eventType,
      severity: i.severity,
      headline: i.headline,
      area_desc: i.areaDesc,
      expires_at: i.expiresAt,
      distance_meters: i.distanceMeters,
      distance_miles: Number(distanceMiles.toFixed(2)),
    },
    // null at fire time; enriched values land shortly after and are available
    // from GET /api/zip-insights.
    nowcast: i.nowcast,
    status: i.status,
    created_at: i.createdAt,
  }
}

async function dispatchOne(
  sub: WebhookSubscription,
  eventType: string,
  payload: object,
): Promise<void> {
  const start = Date.now()
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "storm-sentry-poc-webhook/1",
    "X-Storm-Sentry-Event": eventType,
  }
  if (sub.secret) headers["Authorization"] = `Bearer ${sub.secret}`

  let status: number | null = null
  let ok = false
  let errorMessage: string | null = null
  try {
    const res = await fetch(sub.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(5_000),
    })
    status = res.status
    ok = res.ok
    if (!res.ok) errorMessage = `HTTP ${res.status}`
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  recordDelivery({
    id: `dlv_${Math.random().toString(36).slice(2, 10)}`,
    subscriptionId: sub.id,
    url: sub.url,
    eventType,
    status,
    ok,
    error: errorMessage,
    attemptedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    payloadPreview: body.slice(0, 240),
  })
}

export function startWebhookDispatcher(): { started: boolean; reason?: string } {
  if (globalThis.__stormSentryWebhookDispatcher) {
    return { started: false, reason: "already running" }
  }
  const fanOut = (eventType: string, payload: object) => {
    const subs = listWebhooks().filter(
      (s) => s.events.includes(eventType) || s.events.includes("*"),
    )
    for (const sub of subs) {
      // Fire and forget; deliveries are recorded inside dispatchOne.
      void dispatchOne(sub, eventType, payload)
    }
  }
  const unsubscribe = subscribe((event) => {
    if (event.type === "match_created") {
      fanOut(event.type, buildPayload(event))
    } else if (event.type === "zip_insight_added") {
      fanOut(event.type, buildZipInsightPayload(event))
    }
  })
  globalThis.__stormSentryWebhookDispatcher = { unsubscribe }
  return { started: true }
}
