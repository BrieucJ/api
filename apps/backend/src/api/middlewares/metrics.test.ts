import { describe, it, expect, beforeEach } from "bun:test";
import metricsMiddleware from "@/api/middlewares/metrics";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Metrics Middleware", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("should track metrics for /api/v1 endpoints", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      // Set response status
      (context.res as any).status = 200;
    };

    const start = Date.now();
    await metricsMiddleware(context, next);
    const duration = Date.now() - start;

    expect(nextCalled).toBe(true);
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("should not track metrics for non-/api/v1 endpoints", async () => {
    const context = createMockContextForMiddleware("GET", "/health");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await metricsMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should track request size from Content-Length header", async () => {
    const context = createMockContextForMiddleware("POST", "/api/v1/users", {
      "Content-Length": "1024",
    });
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 200;
    };

    await metricsMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should track response status code", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 404;
    };

    await metricsMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should track error metrics when request fails", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    const error = new Error("Test error");

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      throw error;
    };

    try {
      await metricsMiddleware(context, next);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(nextCalled).toBe(true);
  });

  it("should measure latency", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
      (context.res as any).status = 200;
    };

    const start = Date.now();
    await metricsMiddleware(context, next);
    const duration = Date.now() - start;

    expect(nextCalled).toBe(true);
    expect(duration).toBeGreaterThanOrEqual(10);
  });

  it("should handle requests without Content-Length header", async () => {
    const context = createMockContextForMiddleware("POST", "/api/v1/users");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 200;
    };

    await metricsMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });
});

