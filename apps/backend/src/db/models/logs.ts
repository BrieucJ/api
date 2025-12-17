import { pgTable, text, integer, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";

extendZodWithOpenApi(z);

export const logs = pgTable(
  "logs",
  {
    source: text().notNull(), // e.g., 'API', 'DB', 'worker'
    level: text().notNull(), // debug, info, warn, error
    message: text().notNull(),
    meta: jsonb(), // structured context
    ...base,
  },
  (table) => [
    check("level_not_blank", sql`char_length(${table.level}) > 0`),
    check("message_not_blank", sql`char_length(${table.message}) > 0`),
  ]
);

// Reusable fields
const sourceField = z.string().openapi({ example: "API" });
const levelField = z
  .enum(["fatal", "error", "warn", "info", "debug", "trace"])
  .openapi({ example: "info" });
const messageField = z.string().min(1).openapi({ example: "Server started" });

// SELECT schema
export const logSelectSchema = createSelectSchema(logs)
  .extend({
    source: sourceField,
    level: levelField,
    message: messageField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("LogSelect");

// INSERT schema
export const logInsertSchema = createInsertSchema(logs)
  .extend({
    source: sourceField,
    level: levelField,
    message: messageField,
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("LogInsert");
