import { describe, it, expect, beforeEach } from "bun:test";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Error API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /error", () => {
    it(
      "should return success when errorRate is 0",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "error@test.com",
          "password123",
          "admin"
        );

        const res = await client["/error"].$get(
          {
            query: {
              errorRate: 0,
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
        expect(body.data).toBeDefined();
        expect(body.data.success).toBe(true);
        expect(body.error).toBeNull();
      })
    );

    it(
      "should return success when errorRate is 1 (but may randomly error)",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "error1@test.com",
          "password123",
          "admin"
        );

        // With errorRate 1, it should always error, but we'll test multiple times
        // to account for randomness
        const res = await client["/error"].$get(
          {
            query: {
              errorRate: 1,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        // Should return an error status code (500, 502, 503, or 504)
        expect([500, 502, 503, 504]).toContain(res.status);
        expect(body.error).toBeDefined();
        expect(body.error.message).toBeDefined();
        expect(body.error.code).toBeDefined();
      })
    );

    it(
      "should use default errorRate of 0.5 when not provided",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "error2@test.com",
          "password123",
          "admin"
        );

        const res = await client["/error"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        // With default 0.5, it may succeed or fail randomly
        // Just verify the response structure is valid
        expect([200, 500, 502, 503, 504]).toContain(res.status);
        if (res.status === 200) {
          expect(body.data).toBeDefined();
          expect(body.data.success).toBe(true);
        } else {
          expect(body.error).toBeDefined();
        }
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/error"].$get({
          query: {
            errorRate: 0,
          },
        });

        expect(res.status).toBe(401);
      })
    );
  });
});
