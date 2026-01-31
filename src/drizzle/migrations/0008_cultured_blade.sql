CREATE TABLE "job_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"wage" numeric,
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
ALTER TABLE "job_listings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- REMOVE THIS LINE: DROP TABLE "job_listings" CASCADE;
--> statement-breakpoint
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_listings_state_abbreviation_index" ON "job_listings" USING btree ("state_abbreviation");--> statement-breakpoint
ALTER TABLE "job_listing_applications" ADD CONSTRAINT "job_listing_applications_job_listing_id_job_listings_id_fk" FOREIGN KEY ("job_listing_id") REFERENCES "public"."job_listings"("id") ON DELETE cascade ON UPDATE no action;