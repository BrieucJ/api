import { db } from "@/db/db";
import { sql } from "drizzle-orm";

/**
 * Truncate all tables (for test cleanup)
 */
export async function truncateAllTables() {
  // Get all table names
  const tables = await db.execute(sql`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE '_drizzle_%'
  `);

  // Truncate each table
  // db.execute returns an array-like result, access rows directly
  const tableRows = Array.isArray(tables) ? tables : (tables as any).rows || [];
  for (const table of tableRows as { tablename: string }[]) {
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${table.tablename} RESTART IDENTITY CASCADE`)
    );
  }
}

/**
 * Reset database to clean state
 */
export async function resetDatabase() {
  await truncateAllTables();
}
