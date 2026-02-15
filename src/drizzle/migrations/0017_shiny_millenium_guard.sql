ALTER TABLE "user_subscriptions" ALTER COLUMN "current_period_start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ALTER COLUMN "current_period_end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ALTER COLUMN "canceled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ALTER COLUMN "trial_start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ALTER COLUMN "trial_end" SET DATA TYPE timestamp with time zone;