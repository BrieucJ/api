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

const geoSourceEnum = pgEnum("geoSource", ["platform", "header", "ip", "none"]);

export const requestSnapshots = pgTable("request_snapshots", {
  method: text().notNull(),
  path: text().notNull(),
  query: jsonb(),
  body: jsonb(),
  headers: jsonb(),
  userId: text(),
  timestamp: timestamp().defaultNow(),
  version: text().notNull(),
  stage: text().notNull(),
  statusCode: integer("status_code"),
  responseBody: jsonb("response_body"),
  responseHeaders: jsonb("response_headers"),
  duration: integer("duration"),
  geoCountry: text("geo_country"),
  geoRegion: text("geo_region"),
  geoCity: text("geo_city"),
  geoLat: doublePrecision("geo_lat"),
  geoLon: doublePrecision("geo_lon"),
  geoSource: geoSourceEnum(),
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
    statusCode: statusCodeField,
    duration: durationField,
    geoCountry: geoCountryField,
    geoRegion: geoRegionField,
    geoCity: geoCityField,
    geoLat: geoLatField,
    geoLon: geoLonField,
    geoSource: geoSourceField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("SnapshotSelect");

export const snapshotInsertSchema = createInsertSchema(requestSnapshots)
  .extend({
    method: methodField,
    path: pathField,
    version: versionField,
    stage: stageField,
    statusCode: statusCodeField,
    duration: durationField,
    geoCountry: geoCountryField,
    geoRegion: geoRegionField,
    geoCity: geoCityField,
    geoLat: geoLatField,
    geoLon: geoLonField,
    geoSource: geoSourceField,
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
    statusCode: statusCodeField.optional(),
    duration: durationField.optional(),
    geoCountry: geoCountryField.optional(),
    geoRegion: geoRegionField.optional(),
    geoCity: geoCityField.optional(),
    geoLat: geoLatField.optional(),
    geoLon: geoLonField.optional(),
    geoSource: geoSourceField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("SnapshotUpdate");
