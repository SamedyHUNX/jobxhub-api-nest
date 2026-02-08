ALTER TYPE "public"."stripe_subscription_status" ADD VALUE 'incomplete';--> statement-breakpoint
ALTER TYPE "public"."stripe_subscription_status" ADD VALUE 'incomplete_expired';--> statement-breakpoint
ALTER TYPE "public"."stripe_subscription_status" ADD VALUE 'trialing';--> statement-breakpoint
ALTER TYPE "public"."stripe_subscription_status" ADD VALUE 'unpaid';--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "stripe_price_id" varchar NOT NULL;--> statement-breakpoint
CREATE INDEX "stripe_customer_idx" ON "user_subscriptions" USING btree ("stripe_customer_id");