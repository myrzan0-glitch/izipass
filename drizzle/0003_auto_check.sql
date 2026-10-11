ALTER TABLE "organizers" ADD COLUMN "auto_approve" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "sha256" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "ocr_text" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "amount_uzs" integer;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "receipt_no" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "verdict" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "checks" jsonb;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "checked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "receipts_sha256_idx" ON "receipts" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "receipts_receipt_no_idx" ON "receipts" USING btree ("receipt_no");