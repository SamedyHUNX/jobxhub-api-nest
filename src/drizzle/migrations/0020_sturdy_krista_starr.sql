ALTER TABLE "payment_history" ALTER COLUMN "paid_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_listings" ADD COLUMN "posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_history" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "job_listings" DROP COLUMN "postedAt";