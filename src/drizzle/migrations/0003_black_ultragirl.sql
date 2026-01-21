-- Drop old constraints first
ALTER TABLE "job_listing_applications" DROP CONSTRAINT "job_listing_applications_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "job_listing_applications" DROP CONSTRAINT "job_listing_applications_jobListingId_userId_pk";
--> statement-breakpoint
-- Rename remaining camelCase columns
ALTER TABLE "job_listing_applications" RENAME COLUMN "userId" TO "user_id";
--> statement-breakpoint
ALTER TABLE "job_listing_applications" RENAME COLUMN "coverLetter" TO "cover_letter";
--> statement-breakpoint
-- Update users table
ALTER TABLE "users" ALTER COLUMN "date_of_birth" SET NOT NULL;
--> statement-breakpoint
-- Add new constraints with correct column names
ALTER TABLE "job_listing_applications" ADD CONSTRAINT "job_listing_applications_job_listing_id_user_id_pk" PRIMARY KEY("job_listing_id","user_id");
--> statement-breakpoint
ALTER TABLE "job_listing_applications" ADD CONSTRAINT "job_listing_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;