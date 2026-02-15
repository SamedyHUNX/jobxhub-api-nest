ALTER TABLE "organizations" DROP CONSTRAINT "organizations_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "jobs_count";