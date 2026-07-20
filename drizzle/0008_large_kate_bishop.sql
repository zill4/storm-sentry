CREATE TABLE "link_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"email" text,
	"name" text,
	"zip" text,
	"source" text DEFAULT 'ghl' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_visit_at" timestamp with time zone,
	"visit_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "link_tokens_contact_id_unique" UNIQUE("contact_id")
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"zip" text,
	"contact_id" text,
	"source" text DEFAULT 'ghl' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"claimed_user_id" text
);
--> statement-breakpoint
CREATE TABLE "site_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"source" text NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "prospects_email_idx" ON "prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "site_visits_visited_at_idx" ON "site_visits" USING btree ("visited_at");--> statement-breakpoint
CREATE INDEX "site_visits_token_idx" ON "site_visits" USING btree ("token");