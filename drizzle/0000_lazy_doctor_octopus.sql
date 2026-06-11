CREATE TABLE "nowcast_cache" (
	"zip" text PRIMARY KEY NOT NULL,
	"values" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storms" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"certainty" text,
	"urgency" text,
	"headline" text,
	"description" text,
	"instruction" text,
	"area_desc" text,
	"sender_name" text,
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"nws_url" text,
	"geometry" jsonb,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tomorrow_budget" (
	"day_key" text PRIMARY KEY NOT NULL,
	"day_count" integer DEFAULT 0 NOT NULL,
	"events_day_count" integer DEFAULT 0 NOT NULL,
	"nowcast_day_count" integer DEFAULT 0 NOT NULL,
	"hour_window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"hour_count" integer DEFAULT 0 NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_throttled" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"url" text NOT NULL,
	"event_type" text NOT NULL,
	"status" integer,
	"ok" boolean NOT NULL,
	"error" text,
	"attempted_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"payload_preview" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"events" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"successes" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"last_dispatch_at" timestamp with time zone,
	"last_error" text,
	"last_status" integer
);
--> statement-breakpoint
CREATE TABLE "zip_insights" (
	"id" text PRIMARY KEY NOT NULL,
	"zip" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"storm_id" text NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"headline" text,
	"area_desc" text,
	"distance_meters" integer NOT NULL,
	"nowcast" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "storms_expires_at_idx" ON "storms" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "storms_severity_idx" ON "storms" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_attempted_at_idx" ON "webhook_deliveries" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "zip_insights_zip_idx" ON "zip_insights" USING btree ("zip");--> statement-breakpoint
CREATE INDEX "zip_insights_storm_id_idx" ON "zip_insights" USING btree ("storm_id");--> statement-breakpoint
CREATE INDEX "zip_insights_status_idx" ON "zip_insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zip_insights_severity_idx" ON "zip_insights" USING btree ("severity");