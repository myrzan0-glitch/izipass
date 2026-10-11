CREATE TYPE "public"."registration_status" AS ENUM('held', 'proof_sent', 'confirmed', 'rejected', 'expired', 'cancelled', 'waitlist');--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "registration_status" DEFAULT 'held' NOT NULL,
	"reference_code" text NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"reject_reason" text,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_registration_idx" ON "receipts" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_user_idx" ON "registrations" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_code_idx" ON "registrations" USING btree ("event_id","reference_code");--> statement-breakpoint
CREATE INDEX "registrations_user_idx" ON "registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "registrations_hold_idx" ON "registrations" USING btree ("hold_expires_at");