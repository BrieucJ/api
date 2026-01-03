import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import env from "@/env";

/**
 * Get the database name from DATABASE_URL
 */
function getDatabaseName(): string {
  const url = new URL(env.DATABASE_URL);
  return url.pathname.slice(1); // Remove leading '/'
}

/**
 * Get the base connection URL (without database name)
 */
function getBaseConnectionUrl(): string {
  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres"; // Connect to default postgres database
  return url.toString();
}

/**
 * Check if test database exists
 */
export async function testDatabaseExists(): Promise<boolean> {
  const baseUrl = getBaseConnectionUrl();
  const client = postgres(baseUrl);

  try {
    const dbName = getDatabaseName();
    const result = await client`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    await client.end();
    return result.length > 0;
  } catch (error) {
    await client.end();
    throw error;
  }
}

/**
 * Create test database if it doesn't exist
 */
export async function createTestDatabase(): Promise<void> {
  const baseUrl = getBaseConnectionUrl();
  const client = postgres(baseUrl);
  const dbName = getDatabaseName();

  try {
    // Check if database exists
    const exists = await testDatabaseExists();
    if (exists) {
      console.log(`Test database "${dbName}" already exists`);
      await client.end();
      return;
    }

    // Create database
    await client.unsafe(`CREATE DATABASE ${dbName}`);
    console.log(`✅ Created test database "${dbName}"`);
  } catch (error) {
    console.error(`❌ Failed to create test database:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Drop test database (use with caution!)
 */
export async function dropTestDatabase(): Promise<void> {
  const baseUrl = getBaseConnectionUrl();
  const client = postgres(baseUrl);
  const dbName = getDatabaseName();

  try {
    // Terminate all connections to the database
    await client.unsafe(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbName}'
        AND pid <> pg_backend_pid()
    `);

    // Drop database
    await client.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log(`✅ Dropped test database "${dbName}"`);
  } catch (error) {
    console.error(`❌ Failed to drop test database:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Run migrations on test database
 */
export async function migrateTestDatabase(): Promise<void> {
  try {
    // Run migrations using drizzle-kit
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    console.log("Running migrations on test database...");
    await execAsync("bun run db:migrate", {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test" },
    });
    console.log("✅ Migrations completed");
  } catch (error) {
    console.error("❌ Failed to run migrations:", error);
    throw error;
  }
}

/**
 * Setup test database (create + migrate)
 */
export async function setupTestDatabase(): Promise<void> {
  await createTestDatabase();
  await migrateTestDatabase();
}

/**
 * Reset test database by truncating all tables
 */
export async function resetTestDatabase(): Promise<void> {
  // Get all table names
  const tables = await db.execute(sql`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_drizzle_%'
  `);

  // Disable foreign key checks temporarily and truncate
  await db.execute(sql`SET session_replication_role = 'replica'`);

  // db.execute returns an array-like result, access rows directly
  const tableRows = Array.isArray(tables) ? tables : (tables as any).rows || [];
  for (const table of tableRows as { tablename: string }[]) {
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${table.tablename} RESTART IDENTITY CASCADE`)
    );
  }

  await db.execute(sql`SET session_replication_role = 'origin'`);
}

/**
 * Run a test in a transaction and rollback after
 * This provides perfect isolation between tests
 *
 * Note: For integration tests using testClient, we rely on resetTestDatabase()
 * in beforeEach for isolation. This function is kept for unit tests that need
 * transaction isolation when testing handlers directly.
 */
export async function runInTransaction<T>(
  testFn: () => Promise<T>
): Promise<T> {
  // For now, just run the test function
  // Transaction isolation is handled by resetTestDatabase in beforeEach
  // TODO: Implement proper transaction support if needed for unit tests
  return await testFn();
}
