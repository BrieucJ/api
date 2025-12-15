import { pgTable, integer, text, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { extendZodWithOpenApi } from "@hono/zod-openapi";
import base from "./_base";

extendZodWithOpenApi(z);

export const users = pgTable(
  "users",
  {
    name: text().notNull(),
    age: integer().notNull(),
    ...base,
  },
  (table) => [
    check("name_not_blank", sql`char_length(${table.name}) > 0`),
    check("age_above_0", sql`${table.age} >= 0`),
  ]
);

const idField = z.number().int().min(1).openapi({ example: 1 });
const nameField = z
  .string()
  .trim()
  .min(1, "Name cannot be blank")
  .openapi({ example: "John Doe" });
const ageField = z.number().int().min(0).openapi({ example: 12 });

export const userSelectSchema = createSelectSchema(users)
  .extend({ id: idField, name: nameField, age: ageField })
  .omit({ deleted_at: true, embedding: true })
  .openapi("UserSelect");

export const userInsertSchema = createInsertSchema(users)
  .extend({ name: nameField, age: ageField })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("UserInsert");

export const userUpdateSchema = createUpdateSchema(users)
  .extend({
    name: nameField.optional(),
    age: ageField.optional(),
  })
  .omit({
    updated_at: true,
    created_at: true,
    deleted_at: true,
    embedding: true,
  })
  .openapi("UserUpdate");
