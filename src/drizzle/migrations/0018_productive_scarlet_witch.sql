ALTER TABLE "organizations" DROP COLUMN "subscription_plan";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "subscription_status";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "subscription_start";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "subscription_end";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
DROP TYPE "public"."stripe_subscription_interval" CASCADE;--> statement-breakpoint
DROP TYPE "public"."stripe_subscription_plan" CASCADE;--> statement-breakpoint
DROP TYPE "public"."stripe_subscription_status" CASCADE;