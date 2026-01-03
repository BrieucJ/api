import { describe, it, expect, beforeEach } from "bun:test";
import loggingMiddleware from "@/api/middlewares/logging";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

describe("Logging Middleware", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("should log GET request", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await loggingMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should log POST request with JSON body", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/json",
    });
    const bodyText = JSON.stringify({ email: "test@example.com" });
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": bodyText.length.toString(),
      },
      body: bodyText,
    });
    (context.req as any).raw = request;

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await loggingMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should capture response body", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    const responseData = { data: { id: 1, name: "Test" } };

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      // Simulate response being set
      context.json(responseData, 200);
    };

    await loggingMiddleware(context, next);

    expect(nextCalled).toBe(true);
    // The middleware should have captured the response body
  });

  it("should handle errors and log them", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    const error = new Error("Test error");

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      throw error;
    };

    try {
      await loggingMiddleware(context, next);
      // If no error was thrown, that's unexpected
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(nextCalled).toBe(true);
  });

  it("should handle non-JSON content types", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "text/plain",
    });
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: "plain text body",
    });
    (context.req as any).raw = request;

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await loggingMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should handle invalid JSON gracefully", async () => {
    const context = createMockContextForMiddleware("POST", "/test", {
      "Content-Type": "application/json",
    });
    const bodyText = "invalid json {";
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: bodyText,
    });
    (context.req as any).raw = request;

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await loggingMiddleware(context, next);

    expect(nextCalled).toBe(true);
  });

  it("should measure request duration", async () => {
    const context = createMockContextForMiddleware("GET", "/test");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    const start = Date.now();
    await loggingMiddleware(context, next);
    const duration = Date.now() - start;

    expect(nextCalled).toBe(true);
    expect(duration).toBeGreaterThanOrEqual(10);
  });
});
