CREATE TYPE "public"."geo_source" AS ENUM('platform', 'header', 'ip', 'none');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "logs" (
	"source" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "level_not_blank" CHECK (char_length("logs"."level") > 0),
	CONSTRAINT "message_not_blank" CHECK (char_length("logs"."message") > 0)
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"endpoint" text NOT NULL,
	"p50_latency" integer NOT NULL,
	"p95_latency" integer NOT NULL,
	"p99_latency" integer NOT NULL,
	"error_rate" integer NOT NULL,
	"traffic_count" integer NOT NULL,
	"request_size" bigint,
	"response_size" bigint,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"token_hash" text NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"device_info" text,
	"ip_address" text,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refresh_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "request_snapshots" (
	"method" text NOT NULL,
	"path" text NOT NULL,
	"query" jsonb,
	"body" jsonb,
	"headers" jsonb,
	"user_id" text,
	"timestamp" timestamp DEFAULT now(),
	"version" text NOT NULL,
	"stage" text NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"response_headers" jsonb,
	"duration" integer,
	"geo_country" text,
	"geo_region" text,
	"geo_city" text,
	"geo_lat" double precision,
	"geo_lon" double precision,
	"geo_source" "geo_source",
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"user_role" "user_role" DEFAULT 'user' NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "worker_stats" (
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
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "worker_stats_last_heartbeat_idx" ON "worker_stats" USING btree ("last_heartbeat");