ALTER TYPE "public"."job_listings_experience_level" ADD VALUE 'manager' BEFORE 'ceo';--> statement-breakpoint
ALTER TYPE "public"."job_listings_wage_interval" ADD VALUE 'weekly';--> statement-breakpoint
ALTER TABLE "job_listings" ALTER COLUMN "wage" SET DATA TYPE numeric;