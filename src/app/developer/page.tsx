import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WebhookManager } from "@/components/webhook-manager"

export const dynamic = "force-dynamic"

const ENDPOINTS: Array<{
  method: string
  path: string
  description: string
}> = [
  { method: "GET", path: "/api/health", description: "Service status + poller stats." },
  { method: "GET", path: "/api/storms", description: "All currently active alerts (NWS + Tomorrow.io + fixtures), sorted by severity then recency." },
  { method: "GET", path: "/api/zip-insights", description: "ZIP-level storm insight queue (storm×ZIP intersection + Tomorrow.io nowcast). Filters: ?status= ?minSeverity= ?source= ?enriched=true ?limit= ?format=ndjson." },
  { method: "POST", path: "/api/zip-insights", description: "Mark insights exported (dequeue). Body: { ids?: string[], all?: boolean }." },
  { method: "GET", path: "/api/businesses", description: "Every contact with notification status, nearest active storm, and distance." },
  { method: "GET", path: "/api/events", description: "Server-sent event stream. Frames: hello, storm_added, storm_updated, storm_removed, zip_insight_added, zip_insight_updated, match_created, matches_pruned, fixtures_cleared, poll_completed." },
  { method: "POST", path: "/api/webhooks", description: "Subscribe a URL. Body: { url, secret?, events? }. events ∈ match_created | zip_insight_added | *. Posts storm_sentry.match.v1 and storm_sentry.zip_insight.v1 payloads." },
  { method: "GET", path: "/api/webhooks", description: "List subscriptions + last 20 deliveries." },
  { method: "DELETE", path: "/api/webhooks/{id}", description: "Unsubscribe." },
  { method: "POST", path: "/api/replay/inject", description: "Inject a fixture storm. Body: { businessId | lat,lng, radiusMiles?, eventType?, severity?, durationMinutes? }." },
  { method: "POST", path: "/api/replay/clear", description: "Clear all fixture storms." },
  { method: "POST", path: "/api/poll-now", description: "Force an NWS poll + matcher cycle (debug)." },
  { method: "POST", path: "/api/webhook-sink", description: "Local capture endpoint. Useful as a webhook target while testing." },
]

const PAYLOAD_EXAMPLE = `{
  "event_type": "storm_sentry.match.v1",
  "fired_at": "2026-05-07T05:49:20.461Z",
  "idempotency_key": "biz-tx-01:fixture:1778133551788:32.777,-96.797",
  "business": {
    "id": "biz-tx-01",
    "name": "Lone Star Roofing",
    "city": "Dallas",
    "state": "TX",
    "lat": 32.7767,
    "lng": -96.797,
    "phone": "+12145551001",
    "email": "ops@lonestarroofing.test",
    "timezone": "America/Chicago"
  },
  "storm": {
    "id": "fixture:...",
    "source": "fixture",
    "event_type": "Severe Thunderstorm Warning",
    "severity": "Severe",
    "headline": "[FIXTURE] Severe Thunderstorm Warning 15mi radius",
    "area_desc": "Fixture centered on Lone Star Roofing (Dallas, TX)",
    "started_at": "2026-05-07T05:49:20.461Z",
    "expires_at": "2026-05-07T07:49:20.461Z",
    "distance_miles": 0.01
  },
  "match": {
    "id": "biz-tx-01:fixture:...",
    "created_at": "2026-05-07T05:49:20.461Z",
    "distance_meters": 14
  }
}`

const ZIP_PAYLOAD_EXAMPLE = `{
  "event_type": "storm_sentry.zip_insight.v1",
  "fired_at": "2026-06-02T17:42:00.000Z",
  "idempotency_key": "75201:https://api.weather.gov/alerts/urn:oid:...",
  "zip": { "code": "75201", "lat": 32.7856, "lng": -96.7983 },
  "storm": {
    "id": "https://api.weather.gov/alerts/urn:oid:...",
    "source": "nws",
    "event_type": "Severe Thunderstorm Warning",
    "severity": "Severe",
    "headline": "Severe Thunderstorm Warning issued ...",
    "area_desc": "Dallas, TX",
    "expires_at": "2026-06-02T18:15:00Z",
    "distance_meters": 4200,
    "distance_miles": 2.61
  },
  "nowcast": {
    "precipIntensity": 0.42,
    "precipProbability": 80,
    "windGust": 38.5,
    "windSpeed": 18.2,
    "temperature": 71.4,
    "weatherCode": 8000,
    "weatherLabel": "Thunderstorm",
    "fetchedAt": "2026-06-02T17:42:10.000Z"
  },
  "status": "queued",
  "created_at": "2026-06-02T17:42:00.000Z"
}`

export default function DeveloperPage() {
  return (
    <main className="min-h-screen bg-[#EEF3F9] text-[#0B2037]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-[#D7E0EA] pb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1FA6E5]">
            Integration
          </span>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Developer
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[#5A6B7E]">
            How an operator&apos;s existing chat application integrates with
            Storm Sentry. Two consumption modes: pull from the JSON snapshot
            endpoints, or have us push <code>storm_sentry.match.v1</code> events
            to a webhook.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">1. Detect</CardTitle>
              <CardDescription className="text-[#5A6B7E]">NWS Alerts API every 60s + fixture injection for demos.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#5A6B7E]">
                Storms are normalized, filtered to roofing-relevant severe weather
                (tornado, severe thunderstorm, high wind, hail, flash flood,
                hurricane, tropical storm) and stored with their NWS polygon.
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">2. Match</CardTitle>
              <CardDescription className="text-[#5A6B7E]">Turf.js 5-mile geo buffer per storm.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#5A6B7E]">
                Every poll, each business location is tested against each storm
                geometry expanded by 5 miles. Matches are idempotent
                (business_id + storm_id) so the same business+storm never fires
                twice.
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">3. Notify</CardTitle>
              <CardDescription className="text-[#5A6B7E]">Webhook POST to operator chat app.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#5A6B7E]">
                The operator&apos;s chat application receives a structured
                payload. The chat app owns message content, replies, and
                opt-outs — Storm Sentry just emits the trigger.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Endpoints</CardTitle>
            <CardDescription className="text-[#5A6B7E]">
              All under <code>http://localhost:8080</code> in this POC. Same
              shape applies after deployment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {ENDPOINTS.map((e) => (
                <li
                  key={`${e.method} ${e.path}`}
                  className="grid grid-cols-[80px_minmax(0,260px)_1fr] items-start gap-3 rounded-lg bg-[#E4EBF3] px-3 py-2"
                >
                  <Badge variant="outline" className="justify-center border-[#D7E0EA] bg-[#FFFFFF] text-[#0B2037]">
                    {e.method}
                  </Badge>
                  <code className="text-sm">{e.path}</code>
                  <span className="text-xs text-[#5A6B7E]">{e.description}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Webhook payload example</CardTitle>
            <CardDescription className="text-[#5A6B7E]">
              Sent on every <code>match_created</code>. Headers:{" "}
              <code>X-Storm-Sentry-Event</code>,{" "}
              <code>Authorization: Bearer &lt;secret&gt;</code> if a secret was
              registered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-xl bg-[#0B2037] p-4 text-xs text-[#FFFFFF]">
              {PAYLOAD_EXAMPLE}
            </pre>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              ZIP insight payload example
            </CardTitle>
            <CardDescription className="text-[#5A6B7E]">
              Sent on every <code>zip_insight_added</code> (subscribe with{" "}
              <code>events: [&quot;zip_insight_added&quot;]</code> or{" "}
              <code>&quot;*&quot;</code>). <code>nowcast</code> is null at fire
              time and filled within seconds — pull enriched values from{" "}
              <code>GET /api/zip-insights?enriched=true</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-xl bg-[#0B2037] p-4 text-xs text-[#FFFFFF]">
              {ZIP_PAYLOAD_EXAMPLE}
            </pre>
          </CardContent>
        </Card>

        <WebhookManager />

        <Card className="rounded-2xl border-[#D7E0EA] bg-[#FFFFFF] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Suggested test loop</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-[#5A6B7E]">
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                Subscribe a webhook to <code>http://localhost:8080/api/webhook-sink</code> with a secret.
              </li>
              <li>
                Open{" "}
                <Link className="text-[#0B2037] underline underline-offset-2" href="/contacts">
                  Contacts
                  <ArrowRight className="ml-0.5 inline size-3" />
                </Link>{" "}
                and click any preset in the demo controls.
              </li>
              <li>
                Watch the deliveries table here populate within ~1s. Open the sink at{" "}
                <code>/api/webhook-sink</code> in another tab to see the captured payloads.
              </li>
              <li>
                Hop to the{" "}
                <Link className="text-[#0B2037] underline underline-offset-2" href="/">
                  Storm Map
                  <ArrowRight className="ml-0.5 inline size-3" />
                </Link>{" "}
                to confirm the fixture polygons appear on the map.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}