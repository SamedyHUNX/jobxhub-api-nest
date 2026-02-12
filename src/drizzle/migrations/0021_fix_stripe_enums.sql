DO $$ BEGIN
 CREATE TYPE "public"."stripe_subscription_interval" AS ENUM('month', 'year');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stripe_subscription_plan" AS ENUM('basic', 'growth', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stripe_subscription_status" AS ENUM('active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
