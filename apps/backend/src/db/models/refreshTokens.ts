import { pgTable, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  createSelectSchema,
  createInsertSchema,
} from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";
import { users } from "./users";

extendZodWithOpenApi(z);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    token_hash: text("token_hash").notNull(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires_at: timestamp("expires_at", { mode: "date" }).notNull(),
    revoked_at: timestamp("revoked_at", { mode: "date" }),
    device_info: text("device_info"),
    ip_address: text("ip_address"),
    ...base,
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("refresh_tokens_token_hash_idx").on(
      table.token_hash
    ),
    userIdIdx: index("refresh_tokens_user_id_idx").on(table.user_id),
    expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expires_at),
  })
);

const idField = z.number().int().min(1).openapi({ example: 1 });
const tokenHashField = z.string().openapi({ example: "scrypt$salt$hash" });
const userIdField = z.number().int().min(1).openapi({ example: 1 });
const expiresAtField = z.date().openapi({ example: new Date() });
const revokedAtField = z.date().nullable().openapi({ example: null });
const deviceInfoField = z.string().nullable().openapi({ example: "Mozilla/5.0..." });
const ipAddressField = z.string().nullable().openapi({ example: "192.168.1.1" });

export const refreshTokenSelectSchema = createSelectSchema(refreshTokens)
  .extend({
    id: idField,
    token_hash: tokenHashField,
    user_id: userIdField,
    expires_at: expiresAtField,
    revoked_at: revokedAtField,
    device_info: deviceInfoField,
    ip_address: ipAddressField,
  })
  .omit({ deleted_at: true, embedding: true })
  .openapi("RefreshTokenSelect");

export const refreshTokenInsertSchema = createInsertSchema(refreshTokens)
  .extend({
    token_hash: tokenHashField,
    user_id: userIdField,
    expires_at: expiresAtField,
    revoked_at: revokedAtField.optional(),
    device_info: deviceInfoField.optional(),
    ip_address: ipAddressField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("RefreshTokenInsert");

