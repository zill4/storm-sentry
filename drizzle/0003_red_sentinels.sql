CREATE TABLE "ghl_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"storm_id" text NOT NULL,
	"zip" text NOT NULL,
	"tag" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ghl_notifications_storm_id_idx" ON "ghl_notifications" USING btree ("storm_id");