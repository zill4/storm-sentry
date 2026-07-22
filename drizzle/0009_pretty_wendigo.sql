CREATE TABLE "design_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"draft_key" text,
	"source" text DEFAULT 'chat' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"email" text,
	"full_name" text,
	"business_name" text,
	"shipping_address" text,
	"phone" text,
	"website" text,
	"qr_action" text,
	"qr_target_url" text,
	"services" jsonb,
	"vendor_badges" jsonb,
	"how_found" text,
	"how_found_other" text,
	"design_style" text,
	"special_instructions" text,
	"consent_transactional_sms" boolean DEFAULT false NOT NULL,
	"consent_marketing_sms" boolean DEFAULT false NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"google_form_response_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_requests_draft_key_unique" UNIQUE("draft_key"),
	CONSTRAINT "design_requests_google_form_response_id_unique" UNIQUE("google_form_response_id")
);
--> statement-breakpoint
CREATE TABLE "design_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"kind" text DEFAULT 'logo' NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"version" integer NOT NULL,
	"parent_design_id" text,
	"style_key" text,
	"prompt" text,
	"revision_note" text,
	"model" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"raw_storage_key" text,
	"storage_key" text,
	"width" integer,
	"height" integer,
	"qr_slug" text,
	"selected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"user_id" text,
	"design_id" text NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"notes" text,
	"events" jsonb NOT NULL,
	"team_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "qr_links" (
	"slug" text PRIMARY KEY NOT NULL,
	"target_url" text NOT NULL,
	"request_id" text,
	"created_by_user_id" text,
	"label" text,
	"hits" integer DEFAULT 0 NOT NULL,
	"last_scan_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_requests" ADD CONSTRAINT "design_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_uploads" ADD CONSTRAINT "design_uploads_request_id_design_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."design_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_request_id_design_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."design_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_request_id_design_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."design_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_links" ADD CONSTRAINT "qr_links_request_id_design_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."design_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_requests_user_id_idx" ON "design_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "design_requests_status_idx" ON "design_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "design_uploads_request_id_idx" ON "design_uploads" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "designs_request_id_idx" ON "designs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "designs_status_idx" ON "designs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");