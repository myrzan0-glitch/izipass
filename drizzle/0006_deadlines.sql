ALTER TABLE "events" ADD COLUMN "registration_closes_before" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- Events already live count as published when they were created.
UPDATE "events" SET "published_at" = "created_at" WHERE "status" <> 'draft';
