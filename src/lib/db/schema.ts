import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

// Relative imports (not the @/ alias) so drizzle-kit's bundler resolves them.
import type { StormGeometry } from "../storms/types"
import type { NormalizedForecast, NowcastValues } from "../tomorrow/types"

// Active severe-weather alerts (NWS + Tomorrow.io + fixtures). Mirrors StormEvent.
export const storms = pgTable(
  "storms",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull(),
    certainty: text("certainty"),
    urgency: text("urgency"),
    headline: text("headline"),
    description: text("description"),
    instruction: text("instruction"),
    areaDesc: text("area_desc"),
    senderName: text("sender_name"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    nwsUrl: text("nws_url"),
    geometry: jsonb("geometry").$type<StormGeometry | null>(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("storms_expires_at_idx").on(t.expiresAt),
    index("storms_severity_idx").on(t.severity),
  ],
)

// Exportable ZIP-level insight queue. Mirrors ZipInsightEvent (id = `zip:stormId`).
export const zipInsights = pgTable(
  "zip_insights",
  {
    id: text("id").primaryKey(),
    zip: text("zip").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    stormId: text("storm_id").notNull(),
    source: text("source").notNull(),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull(),
    headline: text("headline"),
    areaDesc: text("area_desc"),
    distanceMeters: integer("distance_meters").notNull(),
    nowcast: jsonb("nowcast").$type<NowcastValues | null>(),
    status: text("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("zip_insights_zip_idx").on(t.zip),
    index("zip_insights_storm_id_idx").on(t.stormId),
    index("zip_insights_status_idx").on(t.status),
    index("zip_insights_severity_idx").on(t.severity),
  ],
)

// Webhook subscriptions. Mirrors WebhookSubscription.
export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  secret: text("secret"),
  events: jsonb("events").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
  successes: integer("successes").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  lastDispatchAt: timestamp("last_dispatch_at", { withTimezone: true }),
  lastError: text("last_error"),
  lastStatus: integer("last_status"),
})

// Recent webhook delivery log (bounded by periodic prune). Mirrors WebhookDelivery.
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id").notNull(),
    url: text("url").notNull(),
    eventType: text("event_type").notNull(),
    status: integer("status"),
    ok: boolean("ok").notNull(),
    error: text("error"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    payloadPreview: text("payload_preview").notNull(),
  },
  (t) => [index("webhook_deliveries_attempted_at_idx").on(t.attemptedAt)],
)

// Per-ZIP Tomorrow.io nowcast cache, shared across replicas (TTL enforced in code).
export const nowcastCache = pgTable("nowcast_cache", {
  zip: text("zip").primaryKey(),
  values: jsonb("values").$type<NowcastValues>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
})

// Per-ZIP forecast cache (the on-demand /forecast page). Shared across replicas;
// TTL enforced in code so repeated lookups of the same ZIP never re-hit the API.
export const forecastCache = pgTable("forecast_cache", {
  zip: text("zip").primaryKey(),
  payload: jsonb("payload").$type<NormalizedForecast>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
})

// Shared Tomorrow.io budget counters (one row per UTC day). The single source of
// truth so multiple replicas can't each spend a full budget. canSpend/record are
// atomic UPDATEs against this row. (Per-second burst stays a per-instance check.)
export const tomorrowBudget = pgTable("tomorrow_budget", {
  dayKey: text("day_key").primaryKey(), // UTC YYYY-MM-DD
  dayCount: integer("day_count").notNull().default(0),
  eventsDayCount: integer("events_day_count").notNull().default(0),
  nowcastDayCount: integer("nowcast_day_count").notNull().default(0),
  hourWindowStart: timestamp("hour_window_start", { withTimezone: true }).notNull().defaultNow(),
  hourCount: integer("hour_count").notNull().default(0),
  totalCalls: integer("total_calls").notNull().default(0),
  totalThrottled: integer("total_throttled").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
