import { describe, it, expect, beforeEach } from "bun:test";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Health API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /health", () => {
    it(
      "should return health status when authenticated",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "health@test.com",
          "password123",
          "admin"
        );

        const res = await client["/health"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect([200, 503]).toContain(res.status); // Can be healthy or unhealthy
        expect(body.data).toBeDefined();
        expect(body.data.status).toBeDefined();
        expect(["healthy", "unhealthy", "degraded"]).toContain(
          body.data.status
        );
        expect(body.data.timestamp).toBeDefined();
        expect(body.data.uptime).toBeDefined();
        expect(typeof body.data.uptime).toBe("number");
        expect(body.data.database).toBeDefined();
        expect(body.data.database.status).toBeDefined();
        expect(body.data.worker).toBeDefined();
        expect(body.data.worker.status).toBeDefined();
        expect(["healthy", "unhealthy", "unknown"]).toContain(
          body.data.worker.status
        );
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/health"].$get();

        expect(res.status).toBe(401);
      })
    );

    it(
      "should include database health information",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "health2@test.com",
          "password123",
          "admin"
        );

        const res = await client["/health"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(body.data.database).toBeDefined();
        expect(body.data.database.connected).toBeDefined();
        expect(typeof body.data.database.connected).toBe("boolean");
        expect(body.data.database.responseTime).toBeDefined();
        expect(typeof body.data.database.responseTime).toBe("number");
      })
    );

    it(
      "should include worker health information",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "health3@test.com",
          "password123",
          "admin"
        );

        const res = await client["/health"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(body.data.worker).toBeDefined();
        expect(body.data.worker.workerMode).toBeDefined();
        expect(["local", "lambda", "unknown"]).toContain(
          body.data.worker.workerMode
        );
      })
    );
  });
});
