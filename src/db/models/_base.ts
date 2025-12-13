import { timestamp, integer, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export default {
  id: integer().generatedAlwaysAsIdentity().primaryKey(),
  updated_at: timestamp().$onUpdate(
    () => sql`(now() AT TIME ZONE 'utc'::text)`
  ),
  created_at: timestamp().defaultNow().notNull(),
  deleted_at: timestamp(),
  embedding: vector({ dimensions: 16 }),
};
