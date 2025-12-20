ALTER TABLE "request_snapshots" ADD COLUMN "geo_country" text;--> statement-breakpoint
ALTER TABLE "request_snapshots" ADD COLUMN "geo_region" text;--> statement-breakpoint
ALTER TABLE "request_snapshots" ADD COLUMN "geo_city" text;--> statement-breakpoint
ALTER TABLE "request_snapshots" ADD COLUMN "geo_lat" double precision;--> statement-breakpoint
ALTER TABLE "request_snapshots" ADD COLUMN "geo_lon" double precision;--> statement-breakpoint
ALTER TABLE "request_snapshots" ADD COLUMN "geo_source" text;