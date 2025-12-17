import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";
import {
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";

extendZodWithOpenApi(z);

export const metrics = pgTable("metrics", {
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  endpoint: text().notNull(),
  p95Latency: integer("p95_latency").notNull(),
  errorRate: integer("error_rate").notNull(),
  trafficCount: integer("traffic_count").notNull(),
  ...base,
});

const endpointField = z.string().min(1).openapi({ example: "/api/metrics" });
const p95LatencyField = z.number().int().min(0).openapi({ example: 120 });
const errorRateField = z.number().min(0).max(1).openapi({ example: 0.02 });
const trafficCountField = z.number().int().min(0).openapi({ example: 456 });

export const metricsSelectSchema = createSelectSchema(metrics)
  .extend({
    endpoint: endpointField,
    p95Latency: p95LatencyField,
    errorRate: errorRateField,
    trafficCount: trafficCountField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("MetricsSelect");

export const metricsInsertSchema = createInsertSchema(metrics)
  .extend({
    endpoint: endpointField,
    p95Latency: p95LatencyField,
    errorRate: errorRateField,
    trafficCount: trafficCountField,
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("MetricsInsert");

export const metricsUpdateSchema = createUpdateSchema(metrics)
  .extend({
    endpoint: endpointField.optional(),
    p95Latency: p95LatencyField.optional(),
    errorRate: errorRateField.optional(),
    trafficCount: trafficCountField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("MetricsUpdate");
