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
  { method: "GET", path: "/api/storms", description: "All currently active alerts (NWS + fixtures), sorted by severity then recency." },
  { method: "GET", path: "/api/businesses", description: "Every contact with notification status, nearest active storm, and distance." },
  { method: "GET", path: "/api/events", description: "Server-sent event stream. Frames: hello, storm_added, storm_updated, storm_removed, match_created, matches_pruned, fixtures_cleared, poll_completed." },
  { method: "POST", path: "/api/webhooks", description: "Subscribe a URL. Body: { url, secret?, events? }. Posts storm_sentry.match.v1 payloads." },
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

export default function DeveloperPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f6] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Developer</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            How an operator&apos;s existing chat application integrates with
            Storm Sentry. Two consumption modes: pull from the JSON snapshot
            endpoints, or have us push <code>storm_sentry.match.v1</code> events
            to a webhook.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Detect</CardTitle>
              <CardDescription>NWS Alerts API every 60s + fixture injection for demos.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-600">
                Storms are normalized, filtered to roofing-relevant severe weather
                (tornado, severe thunderstorm, high wind, hail, flash flood,
                hurricane, tropical storm) and stored with their NWS polygon.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Match</CardTitle>
              <CardDescription>Turf.js 5-mile geo buffer per storm.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-600">
                Every poll, each business location is tested against each storm
                geometry expanded by 5 miles. Matches are idempotent
                (business_id + storm_id) so the same business+storm never fires
                twice.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Notify</CardTitle>
              <CardDescription>Webhook POST to operator chat app.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-600">
                The operator&apos;s chat application receives a structured
                payload. The chat app owns message content, replies, and
                opt-outs — Storm Sentry just emits the trigger.
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-lg border-zinc-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Endpoints</CardTitle>
            <CardDescription>
              All under <code>http://localhost:8080</code> in this POC. Same
              shape applies after deployment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {ENDPOINTS.map((e) => (
                <li
                  key={`${e.method} ${e.path}`}
                  className="grid grid-cols-[80px_minmax(0,260px)_1fr] items-start gap-3 rounded-md border border-zinc-100 bg-zinc-50/60 px-3 py-2"
                >
                  <Badge variant="outline" className="justify-center bg-white">
                    {e.method}
                  </Badge>
                  <code className="text-sm">{e.path}</code>
                  <span className="text-xs text-zinc-700">{e.description}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-zinc-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Webhook payload example</CardTitle>
            <CardDescription>
              Sent on every <code>match_created</code>. Headers:{" "}
              <code>X-Storm-Sentry-Event</code>,{" "}
              <code>Authorization: Bearer &lt;secret&gt;</code> if a secret was
              registered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
              {PAYLOAD_EXAMPLE}
            </pre>
          </CardContent>
        </Card>

        <WebhookManager />

        <Card className="rounded-lg border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle className="text-base">Suggested test loop</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-zinc-800">
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                Subscribe a webhook to <code>http://localhost:8080/api/webhook-sink</code> with a secret.
              </li>
              <li>
                Open{" "}
                <Link className="text-emerald-800 underline" href="/contacts">
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
                <Link className="text-emerald-800 underline" href="/">
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
