CREATE TYPE "public"."job_listing_applications_state" AS ENUM('denied', 'applied', 'interviewed', 'hired');--> statement-breakpoint
CREATE TYPE "public"."job_listings_experience_level" AS ENUM('junior', 'mid', 'senior', 'lead', 'ceo', 'director');--> statement-breakpoint
CREATE TYPE "public"."job_listings_status" AS ENUM('draft', 'published', 'delisted');--> statement-breakpoint
CREATE TYPE "public"."job_listings_type" AS ENUM('internship', 'part-time', 'full-time', 'freelance', 'contract');--> statement-breakpoint
CREATE TYPE "public"."job_listings_location_requirement" AS ENUM('in-office', 'hybrid', 'remote');--> statement-breakpoint
CREATE TYPE "public"."job_listings_wage_interval" AS ENUM('hourly', 'yearly', 'monthly');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar NOT NULL,
	"image_url" varchar NOT NULL,
	"password" varchar NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"full_name" varchar,
	"reset_password_token" varchar,
	"reset_password_expires" timestamp with time zone,
	"token_version" integer DEFAULT 0 NOT NULL,
	"is_banned" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"is_disabled" boolean DEFAULT false,
	"verification_token" varchar,
	"user_role" varchar DEFAULT 'USER' NOT NULL,
	"verification_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_resumes" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"resume_file_url" varchar NOT NULL,
	"resume_file_key" varchar NOT NULL,
	"ai_summary" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"new_job_email_notifications" boolean DEFAULT false NOT NULL,
	"ai_prompt" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_name" varchar NOT NULL,
	"image_url" varchar,
	"slug" varchar NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"members_count" integer DEFAULT 0 NOT NULL,
	"pending_invitations_count" integer DEFAULT 0 NOT NULL,
	"admin_delete_enabled" boolean DEFAULT false NOT NULL,
	"max_allowed_memberships" integer DEFAULT 5,
	"jobs_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_user_settings" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar DEFAULT 'Member' NOT NULL,
	"new_application_email_notifications" boolean DEFAULT false NOT NULL,
	"minimum_rating" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_user_settings_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "job_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"wage" integer,
	"wage_interval" "job_listings_wage_interval",
	"state_abbreviation" varchar,
	"city" varchar,
	"is_featured" boolean DEFAULT false NOT NULL,
	"location_requirement" "job_listings_location_requirement" NOT NULL,
	"experience_level" "job_listings_experience_level" NOT NULL,
	"status" "job_listings_status" DEFAULT 'draft' NOT NULL,
	"type" "job_listings_type" NOT NULL,
	"postedAt" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_listing_applications" (
	"jobListingId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"coverLetter" text,
	"rating" integer,
	"stage" "job_listing_applications_state" DEFAULT 'applied' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_listing_applications_jobListingId_userId_pk" PRIMARY KEY("jobListingId","userId")
);
--> statement-breakpoint
ALTER TABLE "user_resumes" ADD CONSTRAINT "user_resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_settings" ADD CONSTRAINT "organization_user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_settings" ADD CONSTRAINT "organization_user_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_listing_applications" ADD CONSTRAINT "job_listing_applications_jobListingId_job_listings_id_fk" FOREIGN KEY ("jobListingId") REFERENCES "public"."job_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_listing_applications" ADD CONSTRAINT "job_listing_applications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_listings_state_abbreviation_index" ON "job_listings" USING btree ("state_abbreviation");