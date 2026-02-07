ALTER TABLE "organizations" ADD COLUMN "subscription_plan" varchar DEFAULT 'BASIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "subscription_status" varchar DEFAULT 'inactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "subscription_start" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "subscription_end" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" varchar;