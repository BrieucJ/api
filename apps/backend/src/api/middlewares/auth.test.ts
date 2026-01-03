import { describe, it, expect, beforeEach } from "bun:test";
import auth from "@/api/middlewares/auth";
import { createAuthenticatedContextForMiddleware } from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Auth Middleware", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("should allow access with valid admin token", async () => {
    const context = await createAuthenticatedContextForMiddleware(
      "GET",
      "/logs",
      "admin"
    );

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    const result = await auth(context, next);

    expect(nextCalled).toBe(true);
    expect(context.get("user")).toBeDefined();
    expect(context.get("user").role).toBe("admin");
    // Middleware returns undefined when successful (just calls next)
    expect(result).toBeUndefined();
  });

  it("should reject non-admin user", async () => {
    const context = await createAuthenticatedContextForMiddleware(
      "GET",
      "/logs",
      "user"
    );

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    try {
      const result = await auth(context, next);
      expect(nextCalled).toBe(false);
      expect(result).toBeInstanceOf(Response);
      const body = (await (result as Response).json()) as any;
      expect(body.error?.message || body.message).toContain("Admin");
    } catch (error) {
      // If JWT middleware throws, that's also acceptable
      expect(error).toBeDefined();
      expect(nextCalled).toBe(false);
    }
  });

  it("should reject request without token", async () => {
    const { createMockContextForMiddleware } = await import(
      "@/tests/helpers/test-helpers"
    );
    const context = createMockContextForMiddleware("GET", "/logs");
    // No Authorization header

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    try {
      const result = await auth(context, next);
      // If no error was thrown, result should be a Response
      expect(nextCalled).toBe(false);
      expect(result).toBeInstanceOf(Response);
      const body = (await (result as Response).json()) as any;
      expect(body.error || body).toBeDefined();
    } catch (error) {
      // JWT middleware throws HTTPException, which is expected
      expect(error).toBeDefined();
      expect(nextCalled).toBe(false);
    }
  });
});
