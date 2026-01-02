import { pgTable, text, pgEnum } from "drizzle-orm/pg-core";
import {
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";

extendZodWithOpenApi(z);

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const users = pgTable("users", {
  email: text().notNull(),
  password_hash: text().notNull(),
  role: userRoleEnum("user_role").default("user").notNull(),
  ...base,
});

const idField = z.number().int().min(1).openapi({ example: 1 });
const emailField = z.email().openapi({ example: "admin@example.com" });
const roleField = z
  .enum(["admin", "user"])
  .default("user")
  .openapi({ example: "admin" });

export const userSelectSchema = createSelectSchema(users)
  .extend({
    id: idField,
    email: emailField,
    role: roleField,
  })
  .omit({ deleted_at: true, embedding: true, password_hash: true })
  .openapi("UserSelect");

export const userAuthSchema = z
  .object({
    id: idField,
    email: emailField,
    role: roleField,
  })
  .openapi("UserAuth");

export const userInsertSchema = createInsertSchema(users)
  .extend({
    email: emailField,
    password: z.string().min(8).openapi({ example: "password123" }),
  })
  .omit({
    password_hash: true,
    role: true,
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("UserInsert");

export const userUpdateSchema = createUpdateSchema(users)
  .extend({
    email: emailField.optional(),
    password: z
      .string()
      .min(8)
      .optional()
      .openapi({ example: "newpassword123" }),
  })
  .omit({
    role: true,
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
    password_hash: true,
  })
  .openapi("UserUpdate");
