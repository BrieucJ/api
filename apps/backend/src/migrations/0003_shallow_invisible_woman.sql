CREATE TABLE "worker_stats" (
	"worker_mode" text NOT NULL,
	"queue_size" integer DEFAULT 0 NOT NULL,
	"processing_count" integer DEFAULT 0 NOT NULL,
	"scheduled_jobs_count" integer DEFAULT 0 NOT NULL,
	"available_jobs_count" integer DEFAULT 0 NOT NULL,
	"scheduled_jobs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"available_jobs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_heartbeat" timestamp DEFAULT now() NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "worker_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"embedding" vector(16)
);
