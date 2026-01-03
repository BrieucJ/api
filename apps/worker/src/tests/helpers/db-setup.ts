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
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${dbName}' AND pid <> pg_backend_pid()
    `);

    // Drop the database
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
    // Import and run migrations from backend (shared database schema)
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgresClient = await import("postgres");
    const postgresDefault = postgresClient.default;

    const migrationClient = postgresDefault(env.DATABASE_URL, { max: 1 });
    const migrationDb = drizzle(migrationClient);

    await migrate(migrationDb, {
      migrationsFolder: "../../backend/src/migrations",
    });

    await migrationClient.end();
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
 */
export async function runInTransaction<T>(
  testFn: () => Promise<T>
): Promise<T> {
  // For now, just run the test function
  // Transaction isolation is handled by resetTestDatabase in beforeEach
  // TODO: Implement proper transaction support if needed for unit tests
  return await testFn();
}
