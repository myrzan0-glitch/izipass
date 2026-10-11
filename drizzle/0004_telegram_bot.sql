ALTER TABLE "receipts" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "notified_status" "registration_status";--> statement-breakpoint
-- Existing rows are already known to their attendees and organizers: don't message about the past.
UPDATE "registrations" SET "notified_status" = "status";--> statement-breakpoint
UPDATE "receipts" SET "notified_at" = "created_at";
