ALTER TABLE "storms" ADD COLUMN "motion" jsonb;--> statement-breakpoint
ALTER TABLE "zip_insights" ADD COLUMN "eta_minutes" integer;--> statement-breakpoint
ALTER TABLE "zip_insights" ADD COLUMN "eta_source" text;