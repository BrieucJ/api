import { pgTable, integer, text, timestamp, bigint } from "drizzle-orm/pg-core";
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
  window_start: timestamp("window_start", { mode: "date" }).notNull(),
  window_end: timestamp("window_end", { mode: "date" }).notNull(),
  endpoint: text().notNull(),
  p50_latency: integer("p50_latency").notNull(),
  p95_latency: integer("p95_latency").notNull(),
  p99_latency: integer("p99_latency").notNull(),
  error_rate: integer("error_rate").notNull(),
  traffic_count: integer("traffic_count").notNull(),
  request_size: bigint("request_size", { mode: "number" }),
  response_size: bigint("response_size", { mode: "number" }),
  ...base,
});

const endpointField = z.string().min(1).openapi({ example: "/api/metrics" });
const p50LatencyField = z.number().int().min(0).openapi({ example: 80 });
const p95LatencyField = z.number().int().min(0).openapi({ example: 120 });
const p99LatencyField = z.number().int().min(0).openapi({ example: 200 });
const errorRateField = z.number().min(0).max(1).openapi({ example: 0.02 });
const trafficCountField = z.number().int().min(0).openapi({ example: 456 });
const requestSizeField = z
  .number()
  .int()
  .min(0)
  .nullable()
  .openapi({ example: 1024 });
const responseSizeField = z
  .number()
  .int()
  .min(0)
  .nullable()
  .openapi({ example: 2048 });

export const metricsSelectSchema = createSelectSchema(metrics)
  .extend({
    endpoint: endpointField,
    p50_latency: p50LatencyField,
    p95_latency: p95LatencyField,
    p99_latency: p99LatencyField,
    error_rate: errorRateField,
    traffic_count: trafficCountField,
    request_size: requestSizeField,
    response_size: responseSizeField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("MetricsSelect");

export const metricsInsertSchema = createInsertSchema(metrics)
  .extend({
    endpoint: endpointField,
    p50_latency: p50LatencyField,
    p95_latency: p95LatencyField,
    p99_latency: p99LatencyField,
    error_rate: errorRateField,
    traffic_count: trafficCountField,
    request_size: requestSizeField,
    response_size: responseSizeField,
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
    p50_latency: p50LatencyField.optional(),
    p95_latency: p95LatencyField.optional(),
    p99_latency: p99LatencyField.optional(),
    error_rate: errorRateField.optional(),
    traffic_count: trafficCountField.optional(),
    request_size: requestSizeField.optional(),
    response_size: responseSizeField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("MetricsUpdate");
