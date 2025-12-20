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
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  endpoint: text().notNull(),
  p50Latency: integer("p50_latency").notNull(),
  p95Latency: integer("p95_latency").notNull(),
  p99Latency: integer("p99_latency").notNull(),
  errorRate: integer("error_rate").notNull(),
  trafficCount: integer("traffic_count").notNull(),
  requestSize: bigint("request_size", { mode: "number" }),
  responseSize: bigint("response_size", { mode: "number" }),
  ...base,
});

const endpointField = z.string().min(1).openapi({ example: "/api/metrics" });
const p50LatencyField = z.number().int().min(0).openapi({ example: 80 });
const p95LatencyField = z.number().int().min(0).openapi({ example: 120 });
const p99LatencyField = z.number().int().min(0).openapi({ example: 200 });
const errorRateField = z.number().min(0).max(1).openapi({ example: 0.02 });
const trafficCountField = z.number().int().min(0).openapi({ example: 456 });
const requestSizeField = z.number().int().min(0).nullable().openapi({ example: 1024 });
const responseSizeField = z.number().int().min(0).nullable().openapi({ example: 2048 });

export const metricsSelectSchema = createSelectSchema(metrics)
  .extend({
    endpoint: endpointField,
    p50Latency: p50LatencyField,
    p95Latency: p95LatencyField,
    p99Latency: p99LatencyField,
    errorRate: errorRateField,
    trafficCount: trafficCountField,
    requestSize: requestSizeField,
    responseSize: responseSizeField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("MetricsSelect");

export const metricsInsertSchema = createInsertSchema(metrics)
  .extend({
    endpoint: endpointField,
    p50Latency: p50LatencyField,
    p95Latency: p95LatencyField,
    p99Latency: p99LatencyField,
    errorRate: errorRateField,
    trafficCount: trafficCountField,
    requestSize: requestSizeField,
    responseSize: responseSizeField,
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
    p50Latency: p50LatencyField.optional(),
    p95Latency: p95LatencyField.optional(),
    p99Latency: p99LatencyField.optional(),
    errorRate: errorRateField.optional(),
    trafficCount: trafficCountField.optional(),
    requestSize: requestSizeField.optional(),
    responseSize: responseSizeField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("MetricsUpdate");
