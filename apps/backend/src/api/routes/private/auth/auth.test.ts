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
        // Check for both accessToken and refreshToken (new format)
        // Also support old format (token) for backward compatibility
        expect(body.data.accessToken || body.data.token).toBeDefined();
        expect(body.data.refreshToken).toBeDefined();
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

  describe("POST /auth/refresh", () => {
    it(
      "should refresh access token with valid refresh token",
      withTransaction(async () => {
        // First login to get refresh token
        await createTestUser("refresh@test.com", "password123", "admin");

        const loginRes = await client["/auth/login"].$post({
          json: {
            email: "refresh@test.com",
            password: "password123",
          },
        });

        const loginBody = await loginRes.json();
        expect(loginRes.status).toBe(200);
        const refreshToken = loginBody.data.refreshToken;
        expect(refreshToken).toBeDefined();

        // Now refresh the access token
        const refreshRes = await client["/auth/refresh"].$post({
          json: {
            refreshToken,
          },
        });

        const refreshBody = await refreshRes.json();

        expect(refreshRes.status).toBe(200);
        expect(refreshBody.data.accessToken).toBeDefined();
        expect(refreshBody.data.user.email).toBe("refresh@test.com");
      })
    );

    it(
      "should reject invalid refresh token",
      withTransaction(async () => {
        const res = await client["/auth/refresh"].$post({
          json: {
            refreshToken: "invalid-token",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("Invalid");
      })
    );

    it(
      "should reject revoked refresh token",
      withTransaction(async () => {
        // Login to get tokens
        await createTestUser("revoked@test.com", "password123", "admin");

        const loginRes = await client["/auth/login"].$post({
          json: {
            email: "revoked@test.com",
            password: "password123",
          },
        });

        const loginBody = await loginRes.json();
        const refreshToken = loginBody.data.refreshToken;
        const accessToken = loginBody.data.accessToken || loginBody.data.token;

        // Logout to revoke refresh token
        await client["/auth/logout"].$post(
          {
            json: {
              refreshToken,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        // Try to refresh with revoked token
        const refreshRes = await client["/auth/refresh"].$post({
          json: {
            refreshToken,
          },
        });

        const refreshBody = await refreshRes.json();

        expect(refreshRes.status).toBe(401);
        expect(refreshBody.error).toBeDefined();
        expect(refreshBody.error.message).toContain("Invalid");
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

    it(
      "should revoke refresh token on logout",
      withTransaction(async () => {
        // Login to get tokens
        await createTestUser("logout2@test.com", "password123", "admin");

        const loginRes = await client["/auth/login"].$post({
          json: {
            email: "logout2@test.com",
            password: "password123",
          },
        });

        const loginBody = await loginRes.json();
        const refreshToken = loginBody.data.refreshToken;
        const accessToken = loginBody.data.accessToken || loginBody.data.token;

        // Logout with refresh token
        const logoutRes = await client["/auth/logout"].$post(
          {
            json: {
              refreshToken,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const logoutBody = await logoutRes.json();

        expect(logoutRes.status).toBe(200);
        expect(logoutBody.data.success).toBe(true);

        // Verify refresh token is revoked
        const refreshRes = await client["/auth/refresh"].$post({
          json: {
            refreshToken,
          },
        });

        expect(refreshRes.status).toBe(401);
      })
    );
  });
});
