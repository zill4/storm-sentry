CREATE TABLE "zip_alert_events" (
	"id" text PRIMARY KEY NOT NULL,
	"zip" text NOT NULL,
	"storm_id" text NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"headline" text,
	"eta_minutes" integer,
	"expires_at" timestamp with time zone,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "zip_alert_events_zip_idx" ON "zip_alert_events" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "zip_alert_events_recorded_at_idx" ON "zip_alert_events" USING btree ("recorded_at");--> statement-breakpoint
-- Backfill: seed history from the per-ZIP last-alert table (zip_alerts) so the
-- tail isn't empty on day one. Event type is unknown for these old rows.
INSERT INTO "zip_alert_events" ("id", "zip", "storm_id", "source", "event_type", "severity", "headline", "recorded_at")
SELECT "zip" || ':' || "last_storm_id", "zip", "last_storm_id",
       CASE WHEN "last_storm_id" LIKE 'fixture:%' THEN 'fixture'
            WHEN "last_storm_id" LIKE 'tomorrow:%' THEN 'tomorrow'
            ELSE 'nws' END,
       'Severe weather alert', "last_severity", NULL, "last_alerted_at"
FROM "zip_alerts"
WHERE "last_storm_id" NOT LIKE 'fixture:%'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
-- Backfill: currently-active insights carry full event data — prefer them.
INSERT INTO "zip_alert_events" ("id", "zip", "storm_id", "source", "event_type", "severity", "headline", "eta_minutes", "expires_at", "recorded_at")
SELECT "id", "zip", "storm_id", "source", "event_type", "severity", "headline", "eta_minutes", "expires_at", "created_at"
FROM "zip_insights"
WHERE "source" != 'fixture'
ON CONFLICT ("id") DO UPDATE SET
  "event_type" = EXCLUDED."event_type",
  "headline" = EXCLUDED."headline",
  "severity" = EXCLUDED."severity",
  "eta_minutes" = EXCLUDED."eta_minutes",
  "expires_at" = EXCLUDED."expires_at";