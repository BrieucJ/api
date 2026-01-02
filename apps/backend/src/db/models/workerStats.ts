import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import {
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";

extendZodWithOpenApi(z);

export const workerStats = pgTable("worker_stats", {
  worker_mode: text("worker_mode").notNull(), // 'local' or 'lambda'
  queue_size: integer("queue_size").notNull().default(0),
  processing_count: integer("processing_count").notNull().default(0),
  scheduled_jobs_count: integer("scheduled_jobs_count").notNull().default(0),
  available_jobs_count: integer("available_jobs_count").notNull().default(0),
  scheduled_jobs: jsonb("scheduled_jobs").notNull().default([]), // Array of scheduled job objects
  available_jobs: jsonb("available_jobs").notNull().default([]), // Array of available job definitions
  last_heartbeat: timestamp("last_heartbeat", { mode: "date" })
    .notNull()
    .defaultNow(),
  ...base,
});

// Zod schemas
const workerModeField = z
  .enum(["local", "lambda"])
  .openapi({ example: "lambda" });
const queueSizeField = z.number().int().min(0).openapi({ example: 5 });
const processingCountField = z.number().int().min(0).openapi({ example: 2 });
const scheduledJobsCountField = z.number().int().min(0).openapi({ example: 3 });
const availableJobsCountField = z
  .number()
  .int()
  .min(0)
  .openapi({ example: 10 });

const scheduledJobSchema = z.object({
  id: z.string(),
  cronExpression: z.string(),
  jobType: z.string(),
  payload: z.unknown(),
  enabled: z.boolean(),
});

const availableJobSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string().optional(),
});

export const workerStatsSelectSchema = createSelectSchema(workerStats)
  .extend({
    worker_mode: workerModeField,
    queue_size: queueSizeField,
    processing_count: processingCountField,
    scheduled_jobs_count: scheduledJobsCountField,
    available_jobs_count: availableJobsCountField,
    scheduled_jobs: z.array(scheduledJobSchema),
    available_jobs: z.array(availableJobSchema),
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("WorkerStatsSelect");

export const workerStatsInsertSchema = createInsertSchema(workerStats)
  .extend({
    worker_mode: workerModeField,
    queue_size: queueSizeField,
    processing_count: processingCountField,
    scheduled_jobs_count: scheduledJobsCountField,
    available_jobs_count: availableJobsCountField,
    scheduled_jobs: z.array(scheduledJobSchema),
    available_jobs: z.array(availableJobSchema),
  })
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("WorkerStatsInsert");

export const workerStatsUpdateSchema = createUpdateSchema(workerStats)
  .extend({
    worker_mode: workerModeField.optional(),
    queue_size: queueSizeField.optional(),
    processing_count: processingCountField.optional(),
    scheduled_jobs_count: scheduledJobsCountField.optional(),
    available_jobs_count: availableJobsCountField.optional(),
    scheduled_jobs: z.array(scheduledJobSchema).optional(),
    available_jobs: z.array(availableJobSchema).optional(),
  })
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("WorkerStatsUpdate");

export type WorkerStatsSelect = z.infer<typeof workerStatsSelectSchema>;
export type WorkerStatsInsert = z.infer<typeof workerStatsInsertSchema>;
export type WorkerStatsUpdate = z.infer<typeof workerStatsUpdateSchema>;
