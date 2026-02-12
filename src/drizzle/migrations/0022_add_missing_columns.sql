-- Add back the columns that were dropped by CASCADE in migration 0018
-- Using defaults to avoid issues with existing rows
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "plan_name" "stripe_subscription_plan" DEFAULT 'basic' NOT NULL;-->statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "status" "stripe_subscription_status" DEFAULT 'active' NOT NULL;-->statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "interval" "stripe_subscription_interval" DEFAULT 'month' NOT NULL;
