ALTER TABLE "logs" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "metrics" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "request_snapshots" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "worker_stats" DROP COLUMN "embedding";