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
TOMORROW_NOWCAST_SHARE=0.65           # fraction of the daily budget for nowcast
TOMORROW_NOWCAST_PER_CYCLE=5          # max fresh nowcast fetches per poll
TOMORROW_NOWCAST_TTL_MIN=20           # per-ZIP nowcast cache lifetime (min)
TOMORROW_EVENTS_INTERVAL_SECONDS=1800 # CONUS events sweep cadence
POLL_INTERVAL_SECONDS=60              # NWS poll cadence
ENABLE_NWS_POLLER=true
```

To refresh the bundled ZIP dataset: `node scripts/build-zcta.mjs`.

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
