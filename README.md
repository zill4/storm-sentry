# Storm Sentry

A live US storm-intelligence dashboard. It detects severe weather, resolves it
down to the **ZIP-code level**, enriches the most-threatened ZIPs with a
quantitative **Tomorrow.io** nowcast, and stages everything as a queue of
**exportable events** distributable over an API or webhooks.

## How it works

```
NWS alerts (free, unlimited) ─┐
                              ├─► storm store ─► ZIP intersection ─► nowcast enrich ─► ZIP-insight queue
Tomorrow.io events (CONUS) ───┘   (~34k ZCTAs)    (Tomorrow.io)        │
                                                                       ├─► GET /api/zip-insights (pull / NDJSON export)
                                                                       └─► storm_sentry.zip_insight.v1 webhook (push)
```

- **NWS** (`api.weather.gov`) is the free, authoritative backbone for *where* storms are. Polled every 60s.
- **Tomorrow.io** plays two roles (its US events turn out to be re-served NWS alerts, so its *unique* value is the nowcast):
  1. a 2nd severe-weather **events** source — one CONUS sweep (2 polygons) on a slow cadence, deduped against NWS;
  2. per-ZIP **nowcast** enrichment (precip rate, wind gust, temp) — the quantitative data NWS alerts don't carry.
- **ZIP intersection** maps every active storm polygon onto bundled US Census ZCTA centroids (`src/lib/zips/`), producing one queued insight per threatened ZIP — this works off NWS alone.
- The map is a flat dark MapLibre basemap + a three.js "ping" layer + a free **RainViewer** radar layer. (Tomorrow.io map tiles are deliberately *not* used — each tile is a metered API call.)

### Tomorrow.io budget

The free tier allows **500 calls/day, 25/hour, 3/sec** (reset midnight UTC), and
**each map tile counts as a call**. `src/lib/tomorrow/budget.ts` self-tracks
usage (the API's rate-limit headers are Enterprise-only) and gates every call,
splitting the daily budget between `events` and `nowcast`. Live status is on
`GET /api/health`.

## Getting started

```bash
npm run dev          # http://localhost:8080
```

Environment (`.env.local`):

```bash
# Required for live data
NWS_USER_AGENT="storm-sentry (you@example.com)"   # NWS requires a UA header
TOMORROW_IO_API_KEY="..."                          # Tomorrow.io API key

# Optional tuning (defaults shown)
ENABLE_TOMORROW=true                  # set false to run NWS-only
TOMORROW_DAILY_BUDGET=480             # daily call cap (headroom under 500)
TOMORROW_NOWCAST_SHARE=0.55           # daily-budget share for storm nowcasts
TOMORROW_FORECAST_SHARE=0.25          # daily-budget share for the /forecast page
TOMORROW_NOWCAST_PER_CYCLE=5          # max fresh nowcast fetches per poll
TOMORROW_NOWCAST_TTL_MIN=20           # per-ZIP nowcast cache lifetime (min)
FORECAST_CACHE_TTL_MIN=60             # per-ZIP forecast cache lifetime (min)
TOMORROW_EVENTS_INTERVAL_SECONDS=1800 # CONUS events sweep cadence
# DATABASE_URL=postgres://…           # enables the Postgres datastore (else in-memory)
POLL_INTERVAL_SECONDS=60              # NWS poll cadence
ENABLE_NWS_POLLER=true
```

To refresh the bundled ZIP dataset: `node scripts/build-zcta.mjs`.

## Deploy (Railway)

Deploys from GitHub `main` via Nixpacks; runtime config is in [`railway.json`](railway.json) — the start command binds Railway's `$PORT`, health check is `/api/health`, and it runs a **single replica**.

Required service **Variables** (the local `.env.local` is *not* deployed):

- `NWS_USER_AGENT` — required, or every poll fails.
- `TOMORROW_IO_API_KEY` — required for Tomorrow.io enrichment (omit to run NWS-only).
- Optional: the `TOMORROW_*` tuning vars above.

> ⚠️ State is in-memory and **resets on every redeploy**. Keep **1 replica** until the Postgres datastore lands — otherwise the poller and the Tomorrow.io budget counter run per-replica and multiply API usage past the free-tier limit.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status, poller stats, Tomorrow.io budget, ZIP coverage. |
| GET | `/api/storms` | Active alerts (NWS + Tomorrow.io + fixtures). |
| GET | `/api/zip-insights` | ZIP-insight queue. Filters: `status`, `minSeverity`, `source`, `enriched`, `limit`, `format=ndjson`. |
| POST | `/api/zip-insights` | Mark insights exported. Body `{ ids?: string[], all?: boolean }`. |
| GET | `/api/events` | SSE stream (storm + `zip_insight_*` frames). |
| POST | `/api/webhooks` | Subscribe. `events ∈ match_created \| zip_insight_added \| *`. |
| POST | `/api/poll-now` | Force a poll + pipeline cycle (debug). |
| POST | `/api/replay/inject` | Inject a fixture storm. |

See the in-app **Developer** page for payload examples.

## GoHighLevel storm alerts (built in)

When a **new Severe/Extreme storm** threatens ZIPs, the notifier finds every GHL
contact whose postal code matches and adds the **`storm-alert` tag**. Build one
GHL Workflow — *trigger: Contact Tag Added = `storm-alert` → send SMS/email* —
and messaging stays in GHL (content, compliance, opt-outs).

Setup:
1. GHL → Settings → **Private Integrations** → create token with
   `contacts.readonly` + `contacts.write` scopes.
2. Set env: `GHL_PRIVATE_TOKEN`, `GHL_LOCATION_ID` (sub-account id). The
   notifier self-enables when both are present; until then it logs
   "would notify" lines.
3. Create the tag-triggered workflow in GHL. **Two settings matter for repeat
   storms:** enable **Allow Re-Entry** in the workflow settings, and add a final
   action **Remove Contact Tag → `storm-alert`**. GHL's trigger fires on the
   tag-*added* event, so a contact who keeps the tag would never re-trigger.
   The notifier also force-retags (remove→add per storm,
   `GHL_FORCE_RETAG=false` to disable) as a belt-and-suspenders, but re-entry
   must be on or second messages are silently dropped.
4. **Storm data in the message:** before tagging, the notifier writes the storm
   onto the contact as custom-field values, so your SMS/email template uses
   merge tags. Create these **custom fields** once (Settings → Custom Fields →
   Contact, type *Single Line*) with these exact keys:

   | Field key | Example value |
   | --- | --- |
   | `storm_event_type` | Tornado Warning |
   | `storm_severity` | Extreme |
   | `storm_zip` | 75201 (the contact's own ZIP) |
   | `storm_headline` | Tornado Warning issued June 11… |
   | `storm_expires` | Jun 11, 4:45 PM CDT (`GHL_TIME_ZONE`, default America/Chicago) |

   Example SMS: `⚠️ {{contact.storm_event_type}} ({{contact.storm_severity}})
   is affecting your area {{contact.storm_zip}}. {{contact.storm_headline}}.
   Expected until {{contact.storm_expires}}. Stay safe.`
5. **Test safely before a real storm:** `POST /api/ghl-test` (demo-guarded)
   with `{ "contactId": "..." }` or `{ "zip": "12345" }` runs the full
   sequence — custom fields + retag — on one contact with clearly-marked TEST
   data, so you can watch the workflow fire and check the merge tags render.

Safety rails (defaults): only severity ≥ `GHL_MIN_SEVERITY` (Severe);
**fixture storms never notify** unless `GHL_ALLOW_FIXTURES=true`; idempotent
per contact×storm via the `ghl_notifications` table (redeploys can't
re-message); ≤ `GHL_MAX_CONTACTS_PER_STORM` (500) per storm; per-ZIP contact
lookups cached `GHL_CONTACT_CACHE_TTL_MIN` (360) and throttled
(`GHL_MIN_CALL_GAP_MS`, 350). If your tenant's searchable postal field differs,
set `GHL_ZIP_FIELD` (default `postalCode`). Live stats at `GET /api/health`
under `ghl`.

## Demo endpoints in production

`/api/replay/*` and `/api/poll-now` are **blocked on production builds** unless
`ALLOW_DEMO_ENDPOINTS=true` is set — fixture injection fires real webhooks, so
it must not be publicly callable on a live deploy.
