ALTER TABLE "logs" ADD COLUMN "test_job_id" text;--> statement-breakpoint
ALTER TABLE "metrics" ADD COLUMN "test_job_id" text;--> statement-breakpoint
ALTER TABLE "request_snapshots" ADD COLUMN "test_job_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "test_job_id" text;