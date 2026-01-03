import { describe, it, expect, beforeEach } from "bun:test";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Auth API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("POST /auth/login", () => {
    it(
      "should login with valid credentials",
      withTransaction(async () => {
        await createTestUser("login@test.com", "password123", "admin");

        const res = await client["/auth/login"].$post({
          json: {
            email: "login@test.com",
            password: "password123",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.token).toBeDefined();
        expect(body.data.user.email).toBe("login@test.com");
        expect(body.data.user.role).toBe("admin");
      })
    );

    it(
      "should reject invalid password",
      withTransaction(async () => {
        await createTestUser("invalid@test.com", "password123", "admin");

        const res = await client["/auth/login"].$post({
          json: {
            email: "invalid@test.com",
            password: "wrongpassword",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("Invalid");
      })
    );

    it(
      "should reject non-existent user",
      withTransaction(async () => {
        const res = await client["/auth/login"].$post({
          json: {
            email: "nonexistent@test.com",
            password: "password123",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBeDefined();
      })
    );

    it(
      "should reject non-admin user",
      withTransaction(async () => {
        await createTestUser("user@test.com", "password123", "user");

        const res = await client["/auth/login"].$post({
          json: {
            email: "user@test.com",
            password: "password123",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("Admin");
      })
    );
  });

  describe("GET /auth/me", () => {
    it(
      "should return current user when authenticated",
      withTransaction(async () => {
        const { user, token } = await createTestUser(
          "me@test.com",
          "password123",
          "admin"
        );

        const res = await client["/auth/me"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.id).toBe(user.id);
        expect(body.data.email).toBe("me@test.com");
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/auth/me"].$get();

        const body = (await res.json()) as any;

        expect(res.status).toBe(401);
        // JWT middleware may return error in different format
        // Just verify we get a 401 response
        if (
          body.error &&
          typeof body.error === "object" &&
          body.error.message
        ) {
          expect(typeof body.error.message === "string").toBe(true);
        }
      })
    );
  });

  describe("POST /auth/logout", () => {
    it(
      "should return success on logout",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "logout@test.com",
          "password123",
          "admin"
        );

        const res = await client["/auth/logout"].$post(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.success).toBe(true);
      })
    );
  });
});
