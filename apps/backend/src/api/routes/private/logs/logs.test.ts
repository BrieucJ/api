import { describe, it, expect, beforeEach } from "bun:test";
import { logs } from "@/db/models/logs";
import { createQueryBuilder } from "@/db/querybuilder";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

const logQuery = createQueryBuilder<typeof logs>(logs);

describe("Logs API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /logs", () => {
    it(
      "should list all logs",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "logs@test.com",
          "password123",
          "admin"
        );

        // Create test logs
        await logQuery.create({
          source: "API",
          level: "info",
          message: "Test log message 1",
        });
        await logQuery.create({
          source: "DB",
          level: "warn",
          message: "Test log message 2",
        });

        const res = await client["/logs"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              order_by: "id",
              order: "asc",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
        expect(body.data.length).toBeGreaterThanOrEqual(2);
        expect(body.metadata.total).toBeGreaterThanOrEqual(2);
      })
    );

    it(
      "should filter logs by source",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "logs2@test.com",
          "password123",
          "admin"
        );

        const apiLog = await logQuery.create({
          source: "API",
          level: "info",
          message: "API log message",
        });
        await logQuery.create({
          source: "DB",
          level: "info",
          message: "DB log message",
        });

        const res = await client["/logs"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              source__eq: "API",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        // Should have at least the API log we created
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        // All returned logs should have source === "API"
        const allApiLogs = body.data.every((log: any) => log.source === "API");
        expect(allApiLogs).toBe(true);
        // Verify our specific log is in the results
        const hasOurLog = body.data.some((log: any) => log.id === apiLog.id);
        expect(hasOurLog).toBe(true);
      })
    );

    it(
      "should filter logs by level",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "logs3@test.com",
          "password123",
          "admin"
        );

        const errorLog = await logQuery.create({
          source: "API",
          level: "error",
          message: "Error log message",
        });
        await logQuery.create({
          source: "API",
          level: "info",
          message: "Info log message",
        });

        const res = await client["/logs"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              level__eq: "error",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        // Should have at least the error log we created
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        // All returned logs should have level === "error"
        const allErrorLogs = body.data.every((log: any) => log.level === "error");
        expect(allErrorLogs).toBe(true);
        // Verify our specific log is in the results
        const hasOurLog = body.data.some((log: any) => log.id === errorLog.id);
        expect(hasOurLog).toBe(true);
      })
    );

    it(
      "should paginate logs",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "logs4@test.com",
          "password123",
          "admin"
        );

        // Create multiple logs
        for (let i = 0; i < 5; i++) {
          await logQuery.create({
            source: "API",
            level: "info",
            message: `Log message ${i}`,
          });
        }

        const res = await client["/logs"].$get(
          {
            query: {
              limit: 2,
              offset: 0,
              order_by: "id",
              order: "asc",
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBeLessThanOrEqual(2);
        expect(body.metadata.limit).toBe(2);
        expect(body.metadata.offset).toBe(0);
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/logs"].$get({
          query: {
            limit: 10,
            offset: 0,
          },
        });

        expect(res.status).toBe(401);
      })
    );
  });
});
