CREATE EXTENSION IF NOT EXISTS vector;
CREATE TYPE "public"."geo_source" AS ENUM('platform', 'header', 'ip', 'none');--> statement-breakpoint
CREATE TABLE "logs" (
	"source" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"embedding" vector(16),
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
	"deleted_at" timestamp,
	"embedding" vector(16)
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
	"deleted_at" timestamp,
	"embedding" vector(16)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"embedding" vector(16),
	CONSTRAINT "name_not_blank" CHECK (char_length("users"."name") > 0),
	CONSTRAINT "age_above_0" CHECK ("users"."age" >= 0)
);
