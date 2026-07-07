CREATE TABLE "zip_alerts" (
	"zip" text PRIMARY KEY NOT NULL,
	"last_storm_id" text NOT NULL,
	"last_severity" text NOT NULL,
	"last_alerted_at" timestamp with time zone NOT NULL,
	"alert_count" integer DEFAULT 1 NOT NULL
);
