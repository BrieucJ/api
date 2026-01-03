import { describe, it, expect } from "bun:test";
import notFound from "@/api/middlewares/notFound";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";

describe("Not Found Middleware", () => {
  it("should return 404 with path in message", async () => {
    const context = createMockContextForMiddleware("GET", "/nonexistent/path");

    const result = notFound(context);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      message: string;
    };
    expect(body.message).toContain("Not Found");
    expect(body.message).toContain("/nonexistent/path");
  });

  it("should handle different paths", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/missing");

    const result = notFound(context);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(404);
    const body = (await response.json()) as {
      message: string;
    };
    expect(body.message).toContain("/api/v1/missing");
  });
});
