import { describe, it, expect, beforeEach } from "bun:test";
import { refreshTokens } from "@/db/models/refreshTokens";
import { createQueryBuilder } from "@/db/querybuilder";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import {
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiration,
} from "@/utils/refreshToken";
import { db } from "@/db/db";
import { eq } from "drizzle-orm";

const refreshTokenQuery =
  createQueryBuilder<typeof refreshTokens>(refreshTokens);

/**
 * Helper to create a test refresh token
 */
async function createTestRefreshToken(
  userId: number,
  options?: {
    expiresAt?: Date;
    revokedAt?: Date | null;
    deviceInfo?: string | null;
    ipAddress?: string | null;
  }
) {
  const token = generateRefreshToken();
  const tokenHash = await hashRefreshToken(token);
  const expiresAt = options?.expiresAt || getRefreshTokenExpiration();

  const refreshToken = await refreshTokenQuery.create({
    token_hash: tokenHash,
    user_id: userId,
    expires_at: expiresAt,
    revoked_at: options?.revokedAt || null,
    device_info: options?.deviceInfo || null,
    ip_address: options?.ipAddress || null,
  });

  return { refreshToken, token };
}

describe("RefreshTokens API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /api/v1/refresh_tokens", () => {
    it(
      "should list all refresh tokens",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );
        await createTestRefreshToken(user.id);
        await createTestRefreshToken(user.id);

        const res = await client["/api/v1/refresh_tokens"].$get({
          query: {
            limit: 10,
            offset: 0,
            order_by: "id",
            order: "asc",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
        expect(body.data.length).toBeGreaterThanOrEqual(2);
        expect(body.metadata.total).toBeGreaterThanOrEqual(2);
      })
    );

    it(
      "should filter refresh tokens by user_id",
      withTransaction(async () => {
        const { user: user1 } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );
        const { user: user2 } = await createTestUser(
          "user2@test.com",
          "password123",
          "admin"
        );

        await createTestRefreshToken(user1.id);
        await createTestRefreshToken(user2.id);

        const res = await client["/api/v1/refresh_tokens"].$get({
          query: {
            limit: 10,
            offset: 0,
            user_id__eq: user1.id.toString(),
          },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBe(1);
        expect(body.data[0].user_id).toBe(user1.id);
      })
    );

    it(
      "should filter refresh tokens by device_info",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );

        await createTestRefreshToken(user.id, { deviceInfo: "iPhone" });
        await createTestRefreshToken(user.id, { deviceInfo: "Android" });

        const res = await client["/api/v1/refresh_tokens"].$get({
          query: {
            limit: 10,
            offset: 0,
            device_info__ilike: "iphone",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        // Should only return tokens with iPhone in device_info
        body.data.forEach((token: any) => {
          expect(token.device_info?.toLowerCase()).toContain("iphone");
        });
      })
    );

    it(
      "should paginate refresh tokens",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );

        // Create multiple refresh tokens
        for (let i = 0; i < 5; i++) {
          await createTestRefreshToken(user.id);
        }

        const res = await client["/api/v1/refresh_tokens"].$get({
          query: {
            limit: 2,
            offset: 0,
            order_by: "id",
            order: "asc",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBe(2);
        expect(body.metadata.limit).toBe(2);
        expect(body.metadata.offset).toBe(0);
        expect(body.metadata.total).toBeGreaterThanOrEqual(5);
      })
    );

    it(
      "should order refresh tokens by created_at desc",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );

        const { refreshToken: token1 } = await createTestRefreshToken(user.id);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
        const { refreshToken: token2 } = await createTestRefreshToken(user.id);

        const res = await client["/api/v1/refresh_tokens"].$get({
          query: {
            limit: 10,
            offset: 0,
            order_by: "id",
            order: "desc",
          },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBeGreaterThanOrEqual(2);
        // Most recent token should be first
        expect(body.data[0].id).toBeGreaterThanOrEqual(token1.id);
      })
    );
  });

  describe("GET /api/v1/refresh_tokens/:id", () => {
    it(
      "should get refresh token by id",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );
        const { refreshToken } = await createTestRefreshToken(user.id, {
          deviceInfo: "Test Device",
          ipAddress: "192.168.1.1",
        });

        const res = await client["/api/v1/refresh_tokens/:id"].$get({
          param: { id: refreshToken.id.toString() },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.id).toBe(refreshToken.id);
        expect(body.data.user_id).toBe(user.id);
        expect(body.data.device_info).toBe("Test Device");
        expect(body.data.ip_address).toBe("192.168.1.1");
        expect(body.data.token_hash).toBeDefined();
        expect(body.data.expires_at).toBeDefined();
      })
    );

    it(
      "should return 404 for non-existent refresh token",
      withTransaction(async () => {
        const res = await client["/api/v1/refresh_tokens/:id"].$get({
          param: { id: "99999" },
        });

        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("not found");
      })
    );

    it(
      "should include all refresh token fields",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );
        const { refreshToken } = await createTestRefreshToken(user.id);

        const res = await client["/api/v1/refresh_tokens/:id"].$get({
          param: { id: refreshToken.id.toString() },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toHaveProperty("id");
        expect(body.data).toHaveProperty("token_hash");
        expect(body.data).toHaveProperty("user_id");
        expect(body.data).toHaveProperty("expires_at");
        expect(body.data).toHaveProperty("revoked_at");
        expect(body.data).toHaveProperty("device_info");
        expect(body.data).toHaveProperty("ip_address");
        expect(body.data).toHaveProperty("created_at");
        expect(body.data).toHaveProperty("updated_at");
      })
    );
  });

  describe("DELETE /api/v1/refresh_tokens/:id", () => {
    it(
      "should delete refresh token (hard delete)",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );
        const { refreshToken } = await createTestRefreshToken(user.id);

        const res = await client["/api/v1/refresh_tokens/:id"].$delete({
          param: { id: refreshToken.id.toString() },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.id).toBe(refreshToken.id);

        // Verify token is hard deleted (not just soft deleted)
        const [deletedToken] = await db
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.id, refreshToken.id))
          .limit(1);

        expect(deletedToken).toBeUndefined();
      })
    );

    it(
      "should return 404 for non-existent refresh token",
      withTransaction(async () => {
        const res = await client["/api/v1/refresh_tokens/:id"].$delete({
          param: { id: "99999" },
        });

        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("not found");
      })
    );

    it(
      "should delete revoked refresh token",
      withTransaction(async () => {
        const { user } = await createTestUser(
          "user1@test.com",
          "password123",
          "admin"
        );
        const { refreshToken } = await createTestRefreshToken(user.id, {
          revokedAt: new Date(),
        });

        const res = await client["/api/v1/refresh_tokens/:id"].$delete({
          param: { id: refreshToken.id.toString() },
        });

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.id).toBe(refreshToken.id);

        // Verify token is deleted
        const [deletedToken] = await db
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.id, refreshToken.id))
          .limit(1);

        expect(deletedToken).toBeUndefined();
      })
    );
  });
});
