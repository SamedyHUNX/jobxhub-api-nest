CREATE TYPE "public"."stripe_subscription_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."stripe_subscription_plan" AS ENUM('basic', 'growth', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."stripe_subscription_status" AS ENUM('active', 'canceled', 'past_due');--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_name" "stripe_subscription_plan" NOT NULL,
	"status" "stripe_subscription_status" NOT NULL,
	"interval" "stripe_subscription_interval" NOT NULL,
	"stripe_customer_id" varchar NOT NULL,
	"stripe_subscription_id" varchar NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "organization_subscriptions" CASCADE;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_idx" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_sub_unique" ON "user_subscriptions" USING btree ("stripe_subscription_id");