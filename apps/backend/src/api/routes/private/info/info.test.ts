import { describe, it, expect, beforeEach } from "bun:test";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Info API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /info", () => {
    it(
      "should return API information when authenticated",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "info@test.com",
          "password123",
          "admin"
        );

        const res = await client["/info"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBeDefined();
        expect(typeof body.data.name).toBe("string");
        expect(body.data.version).toBeDefined();
        expect(typeof body.data.version).toBe("string");
        expect(body.data.environment).toBeDefined();
        expect(typeof body.data.environment).toBe("string");
        expect(body.data.timestamp).toBeDefined();
        expect(body.data.uptime).toBeDefined();
        expect(body.data.uptime.milliseconds).toBeDefined();
        expect(body.data.uptime.seconds).toBeDefined();
        expect(body.data.uptime.minutes).toBeDefined();
        expect(body.data.uptime.hours).toBeDefined();
        expect(body.data.uptime.days).toBeDefined();
        expect(body.data.uptime.formatted).toBeDefined();
        expect(body.data.apiBasePath).toBe("/api/v1");
        expect(body.data.database).toBeDefined();
        expect(typeof body.data.database.connected).toBe("boolean");
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/info"].$get();

        expect(res.status).toBe(401);
      })
    );

    it(
      "should include valid uptime information",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "info2@test.com",
          "password123",
          "admin"
        );

        const res = await client["/info"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(body.data.uptime.milliseconds).toBeGreaterThanOrEqual(0);
        expect(body.data.uptime.seconds).toBeGreaterThanOrEqual(0);
        expect(body.data.uptime.minutes).toBeGreaterThanOrEqual(0);
        expect(body.data.uptime.hours).toBeGreaterThanOrEqual(0);
        expect(body.data.uptime.days).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.uptime.formatted).toBe("string");
      })
    );
  });
});
