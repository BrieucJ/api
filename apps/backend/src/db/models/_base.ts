import { timestamp, integer, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export default {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  updated_at: timestamp({ mode: "date" })
    .defaultNow()
    .$onUpdate(() => sql`(now() AT TIME ZONE 'utc'::text)`),
  created_at: timestamp({ mode: "date" }).defaultNow().notNull(),
  deleted_at: timestamp({ mode: "date" }),
  embedding: vector({ dimensions: 16 }),
};
