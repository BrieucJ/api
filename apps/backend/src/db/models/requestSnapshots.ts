import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  doublePrecision,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";

extendZodWithOpenApi(z);

export const geoSourceEnum = pgEnum("geo_source", [
  "platform",
  "header",
  "ip",
  "none",
]);

export const requestSnapshots = pgTable("request_snapshots", {
  method: text().notNull(),
  path: text().notNull(),
  query: jsonb(),
  body: jsonb(),
  headers: jsonb(),
  user_id: text("user_id"),
  timestamp: timestamp({ mode: "date" }).defaultNow(),
  version: text().notNull(),
  stage: text().notNull(),
  status_code: integer("status_code"),
  response_body: jsonb("response_body"),
  response_headers: jsonb("response_headers"),
  duration: integer("duration"),
  geo_country: text("geo_country"),
  geo_region: text("geo_region"),
  geo_city: text("geo_city"),
  geo_lat: doublePrecision("geo_lat"),
  geo_lon: doublePrecision("geo_lon"),
  geo_source: geoSourceEnum("geo_source"),
  ...base,
});

const methodField = z.string().min(1).openapi({ example: "POST" });
const pathField = z.string().min(1).openapi({ example: "/api/replay" });
const versionField = z.string().openapi({ example: "1.0.0" });
const stageField = z.string().openapi({ example: "production" });
const statusCodeField = z
  .number()
  .int()
  .min(100)
  .max(599)
  .nullable()
  .openapi({ example: 200 });
const durationField = z
  .number()
  .int()
  .min(0)
  .nullable()
  .openapi({ example: 120 });
const geoCountryField = z.string().nullable().openapi({ example: "US" });
const geoRegionField = z.string().nullable().openapi({ example: "CA" });
const geoCityField = z
  .string()
  .nullable()
  .openapi({ example: "San Francisco" });
const geoLatField = z.number().nullable().openapi({ example: 37.7749 });
const geoLonField = z.number().nullable().openapi({ example: -122.4194 });
const geoSourceField = z
  .enum(["platform", "header", "ip", "none"])
  .nullable()
  .openapi({ example: "platform" });

export const snapshotSelectSchema = createSelectSchema(requestSnapshots)
  .extend({
    method: methodField,
    path: pathField,
    version: versionField,
    stage: stageField,
    status_code: statusCodeField,
    duration: durationField,
    geo_country: geoCountryField,
    geo_region: geoRegionField,
    geo_city: geoCityField,
    geo_lat: geoLatField,
    geo_lon: geoLonField,
    geo_source: geoSourceField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("SnapshotSelect");

export const snapshotInsertSchema = createInsertSchema(requestSnapshots)
  .extend({
    method: methodField,
    path: pathField,
    version: versionField,
    stage: stageField,
    status_code: statusCodeField,
    duration: durationField,
    geo_country: geoCountryField,
    geo_region: geoRegionField,
    geo_city: geoCityField,
    geo_lat: geoLatField,
    geo_lon: geoLonField,
    geo_source: geoSourceField,
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("SnapshotInsert");

export const snapshotUpdateSchema = createUpdateSchema(requestSnapshots)
  .extend({
    method: methodField.optional(),
    path: pathField.optional(),
    version: versionField.optional(),
    stage: stageField.optional(),
    status_code: statusCodeField.optional(),
    duration: durationField.optional(),
    geo_country: geoCountryField.optional(),
    geo_region: geoRegionField.optional(),
    geo_city: geoCityField.optional(),
    geo_lat: geoLatField.optional(),
    geo_lon: geoLonField.optional(),
    geo_source: geoSourceField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("SnapshotUpdate");
