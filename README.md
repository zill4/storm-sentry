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
- **Arrival ETAs**: warned storms carry a radar motion vector (`eventMotionDescription` — cell positions, direction, speed). `src/lib/storms/eta.ts` projects each cell's track onto every threatened ZIP for a **minutes-to-arrival** estimate (`etaSource: "track"`), falling back to a future alert onset (`"onset"`). Exposed on insights, webhooks, GHL fields, and `/zip/{zip}`.
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
SEED_DEMO_BUSINESSES=true             # demo contractor roster (matcher/chat/api). NEVER set in prod.
# GHL_DEV_NOTIFIER=true               # opt-in: run the live GHL notifier from a dev machine
```

To refresh the bundled ZIP dataset: `node scripts/build-zcta.mjs`. To refresh
the ZIP → city/state labels (powers place names + city/state search):
`node scripts/build-zip-places.mjs`.

## Deploy (Railway)

Deploys from GitHub `main` via Nixpacks; runtime config is in [`railway.json`](railway.json) — the start command binds Railway's `$PORT`, health check is `/api/health`, and it runs a **single replica**.

Required service **Variables** (the local `.env.local` is *not* deployed):

- `NWS_USER_AGENT` — required, or every poll fails.
- `TOMORROW_IO_API_KEY` — required for Tomorrow.io enrichment (omit to run NWS-only).
- `APP_BASE_URL` — the public origin (e.g. `https://stormsentry.app`); used for the `/zip/{zip}` links in webhook payloads and GHL fields.
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
| POST | `/api/replay/inject` | Inject a fixture storm. Optional `motion: { headingDeg, speedKt, leadMiles? }` to simulate arrival ETAs. |

### Public ZIP storm report — `/zip/{zip}`

Every ZIP has a public, no-auth storm page (e.g. `/zip/75201`): live alerts,
arrival estimate, cached conditions, and a sign-up CTA. This is the link the
automations embed in outbound email/SMS. Set **`APP_BASE_URL`** to the deployed
origin so payload links point at production. Page views never spend Tomorrow.io
budget (cached nowcast only).

### `storm_sentry.zip_insight.v1` payload (Zapier/webhook contract)

Fired per threatened ZIP on `zip_insight_added`. Key fields:

```jsonc
{
  "zip": { "code": "75051", "lat": 32.72, "lng": -97.0, "url": "https://…/zip/75051" },
  "storm": {
    "event_type": "Severe Thunderstorm Warning",
    "severity": "Severe",
    "headline": "…", "area_desc": "…", "expires_at": "…",
    "distance_miles": 11.87,
    "eta_minutes": 30,          // null when the alert is already overhead
    "eta_hours": 0.5,
    "eta_text": "~30 minutes",  // merge-field friendly ("arriving now" / "~2 hours")
    "eta_source": "track"       // "track" = radar motion, "onset" = alert start time
  },
  "nowcast": null,              // enriched shortly after; pull via GET /api/zip-insights
  "status": "queued"
}
```

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
   | `storm_eta` | `~40 minutes` / `arriving now`; `imminent` when the storm is already overhead. **Never blank**, so you can use it inline (e.g. `ETA: {{contact.storm_eta}}`) without a fallback branch. |
   | `storm_link` | `https://…/zip/75201` (public no-auth storm report for the contact's ZIP) |

   Example SMS: `⚠️ {{contact.storm_event_type}} ({{contact.storm_severity}})
   is affecting your area {{contact.storm_zip}}. {{contact.storm_headline}}.
   Expected until {{contact.storm_expires}}. Live report: {{contact.storm_link}}`
5. **Test safely before a real storm:** `POST /api/ghl-test` (demo-guarded)
   with `{ "contactId": "..." }` or `{ "zip": "12345" }` runs the full
   sequence — custom fields + retag — on one contact with clearly-marked TEST
   data, so you can watch the workflow fire and check the merge tags render.

### The ZIP alert gate (filters BOTH channels)

All outbound alerting — the Zapier webhook **and** the GHL notifier — flows
through one server-side gate (`src/lib/alerts/gate.ts`), keyed entirely by ZIP,
so there's nothing to configure on Zapier or GHL. A ZIP fires an alert only
when it clears:

- **Severity** — `ALERT_MIN_SEVERITY` (default `Severe`): only `Severe`/`Extreme`.
- **Fixtures** — excluded unless `ALERT_ALLOW_FIXTURES=true`.
- **Per-ZIP cooldown** — `ALERT_ZIP_COOLDOWN_HOURS` (default `24`): each ZIP
  triggers at most once per window, **even as NWS renews the same storm under
  new alert IDs** (the root cause of repeat pings — one contact had been tagged
  27× / up to 12 in a day before this). Persisted in the `zip_alerts` table and
  hydrated at boot, so a redeploy mid-event can't reopen the floodgates. Set `0`
  to disable, or lower (e.g. `6`) to allow a genuinely separate later-day storm.

On pass it emits an internal `zip_alert` the channels consume; the external
webhook `event_type` and subscription name are unchanged. Live counts
(`emitted`, `skippedSeverity`, `skippedCooldown`) at `GET /api/health` under
`alertGate`.

GHL delivery rails on top of the gate (defaults): idempotent per contact×storm
via `ghl_notifications` (redeploys can't re-message for the same warning);
**duplicate-human dedupe** — CRMs accumulate multiple contact records for one
person, so within a storm any contact sharing a normalized phone or email with
an already-notified contact is skipped (ledger status `skipped_duplicate`,
stat `ghl.skippedDuplicate`); ≤ `GHL_MAX_CONTACTS_PER_STORM` (500) per storm;
per-ZIP contact lookups cached `GHL_CONTACT_CACHE_TTL_MIN` (360) and throttled
(`GHL_MIN_CALL_GAP_MS`, 350). If your tenant's searchable postal field differs,
set `GHL_ZIP_FIELD` (default `postalCode`). GHL stats at `GET /api/health`
under `ghl`.

### Per-ZIP alert history

The gate also appends every severity-passing, non-fixture insight to
`zip_alert_events` (one row per zip×storm, **before** the cooldown check) —
so `/zip/{zip}` can show a "recent severe weather" tail for the ZIP and its
neighbors (~25 mi) even after the storms themselves expire and get pruned.

### Referral tracking + soft accounts

Outbound `storm_link` values carry an **opaque per-contact token**
(`…/zip/64057?sv=<token>` — never raw email/name; the token resolves
server-side). On landing, a beacon (`POST /api/visit`) records the visit
(`site_visits`: source `ghl` / `referral:<host>` / `direct`), stamps a 90-day
httpOnly cookie, and keeps a **prospect** row fresh (`prospects` — the GHL
contacts we've alerted, created at notify time). The sign-up form prefills
name/email for known visitors, and when someone registers with a matching
email the prospect is **claimed** (linked to their user id) on first
`/account` load. Aggregate picture (no PII): `GET /api/referrals?days=30`
(signed-in only).

## Smart Tarp design studio → moved out

The tarp design funnel now lives in its own app and repo,
[brandall-smart-studio](https://github.com/zill4/brandall-smart-studio),
running as a **second service in this same Railway project**. Two things
survive here:

- **`/q/{slug}`** — tarps printed while the funnel lived on this domain encode
  *this* origin, and they're nailed to roofs. The route stays as a 302 forwarder
  to `STUDIO_BASE_URL`, which resolves the slug and does the real redirect.
  Removing it would brick physical signage.
- **The database.** The studio runs against this same Postgres, so a customer is
  one `user` row across both sites. See [Shared database](#shared-database).

Sessions are *not* shared: cookies are per-domain, so signing in on one site
does not sign you in on the other.

### Shared database

| Owner | Tables |
| --- | --- |
| **This repo** | `storms`, `zip_insights`, `webhooks`, `webhook_deliveries`, `nowcast_cache`, `forecast_cache`, `zip_alerts`, `zip_alert_events`, `link_tokens`, `site_visits`, `prospects`, `ghl_notifications`, `tomorrow_budget` |
| **This repo (shared)** | `user`, `session`, `account`, `verification` — the studio declares these read-only and copies `auth-schema.ts` from here |
| **brandall-smart-studio** | `design_requests`, `design_uploads`, `designs`, `qr_links`, `orders` |

Two rules that keep the split safe:

1. **Never run `drizzle-kit push` against production.** It diffs the live
   database against `schema.ts` and will offer to drop the studio's five tables.
   Use `db:generate` + `db:migrate` and read the SQL first.
2. Migration ledgers are separate — this repo uses the default
   `drizzle.__drizzle_migrations`, the studio uses
   `drizzle.__drizzle_migrations_studio`. See
   [`drizzle/0012_past_tyrannus.sql`](drizzle/0012_past_tyrannus.sql) for what
   happens if you let a generated migration through unread.

Environment added by the split:

```bash
STUDIO_BASE_URL="https://…"   # where /q/{slug} forwards printed QR scans
```

## Demo endpoints in production

`/api/replay/*` and `/api/poll-now` are **blocked on production builds** unless
`ALLOW_DEMO_ENDPOINTS=true` is set — fixture injection fires real webhooks, so
it must not be publicly callable on a live deploy.
