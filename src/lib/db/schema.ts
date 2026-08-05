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
import type { StormGeometry, StormMotion } from "../storms/types"
import type { NormalizedForecast, NowcastValues } from "../tomorrow/types"

// Better Auth tables (user/session/account/verification) are defined separately
// and re-exported here so drizzle-kit migrations and the Drizzle client see them.
//
// This database is SHARED with the Brandall Smart Studio app, which owns the
// Smart Tarp funnel tables (design_requests, design_uploads, designs, qr_links,
// orders). Those are absent here on purpose — this repo must never generate a
// migration that touches them. This repo does still own the auth tables above:
// the studio declares them read-only and copies changes from here.
export * from "./auth-schema"

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
    motion: jsonb("motion").$type<StormMotion | null>(),
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
    etaMinutes: integer("eta_minutes"),
    etaSource: text("eta_source"), // "track" | "onset"
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

// Per-ZIP outbound-alert throttle. One row per ZIP; the alert gate refuses to
// re-fire for a ZIP within its cooldown window, so a single storm event (which
// NWS re-warns under many IDs) triggers each ZIP at most once per window.
// Hydrated into memory at boot so a redeploy can't reset the cooldown.
export const zipAlerts = pgTable("zip_alerts", {
  zip: text("zip").primaryKey(),
  lastStormId: text("last_storm_id").notNull(),
  lastSeverity: text("last_severity").notNull(),
  lastAlertedAt: timestamp("last_alerted_at", { withTimezone: true }).notNull(),
  alertCount: integer("alert_count").notNull().default(1),
})

// Append-only per-ZIP severe-weather history (one row per zip×storm). Written
// by the alert gate for every severity-passing, non-fixture insight — BEFORE
// the cooldown check, so it records storm activity even when the outbound
// alert was suppressed. Storms/insights get pruned when they expire; this
// table is what lets /zip/{zip} show a "recent alerts" tail afterward.
export const zipAlertEvents = pgTable(
  "zip_alert_events",
  {
    id: text("id").primaryKey(), // `${zip}:${stormId}`
    zip: text("zip").notNull(),
    stormId: text("storm_id").notNull(),
    source: text("source").notNull(),
    eventType: text("event_type").notNull(),
    severity: text("severity").notNull(),
    headline: text("headline"),
    etaMinutes: integer("eta_minutes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("zip_alert_events_zip_idx").on(t.zip),
    index("zip_alert_events_recorded_at_idx").on(t.recordedAt),
  ],
)

// Opaque per-GHL-contact referral token, embedded in outbound storm links as
// `?sv=<token>` (never raw email/name — PII stays out of URLs; the token
// resolves server-side). One token per contact, reused across storms so
// repeat visits correlate.
export const linkTokens = pgTable(
  "link_tokens",
  {
    token: text("token").primaryKey(),
    contactId: text("contact_id").notNull().unique(),
    email: text("email"),
    name: text("name"),
    zip: text("zip"),
    source: text("source").notNull().default("ghl"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    visitCount: integer("visit_count").notNull().default(0),
  },
)

// One row per tracked page landing — how visitors reached the site (alert
// link token, external referrer, or direct).
export const siteVisits = pgTable(
  "site_visits",
  {
    id: text("id").primaryKey(),
    token: text("token"), // link_tokens.token when the visit came from an alert link
    source: text("source").notNull(), // "ghl" | "direct" | "referral:<host>"
    path: text("path").notNull(),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("site_visits_visited_at_idx").on(t.visitedAt),
    index("site_visits_token_idx").on(t.token),
  ],
)

// Soft accounts: people we already know (GHL contacts we've alerted) before
// they ever register. When someone signs up with a matching email the row is
// claimed, linking their new user account to the existing CRM identity.
export const prospects = pgTable(
  "prospects",
  {
    id: text("id").primaryKey(), // = GHL contact id for ghl-sourced prospects
    email: text("email"), // lowercased; not unique (CRMs contain dupes)
    name: text("name"),
    zip: text("zip"),
    contactId: text("contact_id"),
    source: text("source").notNull().default("ghl"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    claimedUserId: text("claimed_user_id"),
  },
  (t) => [index("prospects_email_idx").on(t.email)],
)

// One row per contact×storm GHL notification — the idempotency ledger that
// guarantees a contact is never re-messaged for the same storm, even across
// restarts/redeploys.
export const ghlNotifications = pgTable(
  "ghl_notifications",
  {
    id: text("id").primaryKey(), // `${contactId}:${stormId}`
    contactId: text("contact_id").notNull(),
    stormId: text("storm_id").notNull(),
    zip: text("zip").notNull(),
    tag: text("tag").notNull(),
    status: text("status").notNull(), // tagged | failed
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ghl_notifications_storm_id_idx").on(t.stormId)],
)

// Shared Tomorrow.io budget counters (one row per UTC day). The single source of
// truth so multiple replicas can't each spend a full budget. canSpend/record are
// atomic UPDATEs against this row. (Per-second burst stays a per-instance check.)
export const tomorrowBudget = pgTable("tomorrow_budget", {
  dayKey: text("day_key").primaryKey(), // UTC YYYY-MM-DD
  dayCount: integer("day_count").notNull().default(0),
  eventsDayCount: integer("events_day_count").notNull().default(0),
  nowcastDayCount: integer("nowcast_day_count").notNull().default(0),
  forecastDayCount: integer("forecast_day_count").notNull().default(0),
  hourWindowStart: timestamp("hour_window_start", { withTimezone: true }).notNull().defaultNow(),
  hourCount: integer("hour_count").notNull().default(0),
  totalCalls: integer("total_calls").notNull().default(0),
  totalThrottled: integer("total_throttled").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
