import { describe, it, expect, beforeEach } from "bun:test";
import { cleanupLogs } from "@/jobs/handlers/cleanupLogs";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import { withTransaction } from "@/tests/helpers/test-helpers";
import { logs } from "@shared/db";
import { createQueryBuilder } from "@shared/db";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";

const logQuery = createQueryBuilder<typeof logs>(logs);

describe("Cleanup Logs Handler", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it(
    "should delete logs older than specified days",
    withTransaction(async () => {
      // Ensure database is clean before test
      await resetTestDatabase();

      const now = new Date();
      const oldDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago

      // Create old log using raw SQL to ensure created_at is set correctly
      const [oldLogResult] = await db.execute(sql`
        INSERT INTO ${logs} (source, level, message, created_at)
        VALUES ('API', 'info', 'Old log message - test 1', ${oldDate.toISOString()}::timestamp)
        RETURNING id
      `);
      const oldLogId = (oldLogResult as any).id;

      // Create recent log using raw SQL
      const [recentLogResult] = await db.execute(sql`
        INSERT INTO ${logs} (source, level, message, created_at)
        VALUES ('API', 'info', 'Recent log message - test 1', ${now.toISOString()}::timestamp)
        RETURNING id
      `);
      const recentLogId = (recentLogResult as any).id;

      const payload = {
        olderThanDays: 30,
        batchSize: 1000,
      };

      await cleanupLogs(payload);

      // Check that old log was deleted - filter by our test messages
      const { data } = await logQuery.list({
        filters: { message__like: "test 1" },
        limit: 10,
      });

      // Should only have the recent log
      expect(data.length).toBe(1);
      const log = data[0];
      expect(log?.message).toBe("Recent log message - test 1");
      expect(log?.id).toBe(recentLogId);
    })
  );

  it(
    "should handle batch deletion",
    withTransaction(async () => {
      // Ensure database is clean before test
      await resetTestDatabase();

      const now = new Date();
      // Make sure the date is definitely old enough (40 days to be safe)
      const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
      const oldDateStr = oldDate.toISOString();

      // Create multiple old logs using raw SQL to ensure created_at is set correctly
      const logIds = [];
      for (let i = 0; i < 5; i++) {
        const [result] = await db.execute(sql`
          INSERT INTO ${logs} (source, level, message, created_at)
          VALUES ('API', 'info', ${`Old log ${i} - test 2`}, ${oldDateStr}::timestamp)
          RETURNING id
        `);
        logIds.push((result as any).id);
      }

      // Verify all logs were created by checking raw database
      const rawLogsBefore = await db.execute(sql`
        SELECT id, message, created_at FROM ${logs}
        WHERE message LIKE '%test 2%' AND deleted_at IS NULL
      `);
      const rawLogsArray = Array.isArray(rawLogsBefore)
        ? rawLogsBefore
        : (rawLogsBefore as any).rows || [];
      expect(rawLogsArray.length).toBe(5);

      const payload = {
        olderThanDays: 30,
        batchSize: 1000, // Use large batch size to delete all at once
      };

      await cleanupLogs(payload);

      // All old logs should be deleted
      const { data } = await logQuery.list({
        filters: { message__like: "test 2" },
        limit: 10,
      });

      expect(data.length).toBe(0);
    })
  );

  it(
    "should not delete recent logs",
    withTransaction(async () => {
      // Ensure database is clean before test
      await resetTestDatabase();

      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      // Create recent log using raw SQL to ensure created_at is set correctly
      const [recentLogResult] = await db.execute(sql`
        INSERT INTO ${logs} (source, level, message, created_at)
        VALUES ('API', 'info', 'Recent log - test 3', ${recentDate.toISOString()}::timestamp)
        RETURNING id
      `);
      const recentLogId = (recentLogResult as any).id;

      const payload = {
        olderThanDays: 30,
        batchSize: 1000,
      };

      await cleanupLogs(payload);

      // Recent log should still exist - filter by our test message
      const { data } = await logQuery.list({
        filters: { message__like: "test 3" },
        limit: 10,
      });

      expect(data.length).toBe(1);
      expect(data[0]?.message).toBe("Recent log - test 3");
      expect(data[0]?.id).toBe(recentLogId);
    })
  );

  it(
    "should handle empty database",
    withTransaction(async () => {
      const payload = {
        olderThanDays: 30,
        batchSize: 1000,
      };

      // Should not throw
      await cleanupLogs(payload);
      expect(true).toBe(true);
    })
  );
});
