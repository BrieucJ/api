import { describe, it, expect, beforeEach } from "bun:test";
import snapshotMiddleware from "@/api/middlewares/snapshot";
import { createMockContextForMiddleware } from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import { requestSnapshots } from "@/db/models/requestSnapshots";
import { createQueryBuilder } from "@/db/querybuilder";
import { wait } from "@/tests/helpers/test-helpers";

const snapshotsQuery =
  createQueryBuilder<typeof requestSnapshots>(requestSnapshots);

describe("Snapshot Middleware", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("should create snapshot for /api/v1 endpoints", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    (context as any).geo = { source: "none" };
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 200;
    };

    await snapshotMiddleware(context, next);

    expect(nextCalled).toBe(true);

    // Wait for async snapshot creation
    await wait(100);

    // Check if snapshot was created
    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/api/v1/users" },
      limit: 1,
    });

    expect(data.length).toBeGreaterThan(0);
    const snapshot = data[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.method).toBe("GET");
    expect(snapshot?.path).toBe("/api/v1/users");
  });

  it("should not create snapshot for non-/api/v1 endpoints", async () => {
    const context = createMockContextForMiddleware("GET", "/health");
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
    };

    await snapshotMiddleware(context, next);

    expect(nextCalled).toBe(true);

    // Wait a bit to ensure no snapshot is created
    await wait(100);

    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/health" },
      limit: 1,
    });

    expect(data.length).toBe(0);
  });

  it("should capture query parameters", async () => {
    const context = createMockContextForMiddleware(
      "GET",
      "/api/v1/users?limit=10&offset=0"
    );
    (context as any).geo = { source: "none" };
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 200;
    };

    await snapshotMiddleware(context, next);

    expect(nextCalled).toBe(true);

    await wait(100);

    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/api/v1/users" },
      limit: 1,
      order_by: "id",
      order: "desc",
    });

    expect(data.length).toBeGreaterThan(0);
    const snapshot = data[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.query).toBeDefined();
    if (snapshot?.query) {
      expect((snapshot.query as any).limit).toBe("10");
      expect((snapshot.query as any).offset).toBe("0");
    }
  });

  it("should capture request headers (excluding sensitive ones)", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users", {
      "Content-Type": "application/json",
      "User-Agent": "test-agent",
      Authorization: "Bearer secret-token",
    });
    (context as any).geo = { source: "none" };
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 200;
    };

    await snapshotMiddleware(context, next);

    expect(nextCalled).toBe(true);

    await wait(100);

    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/api/v1/users" },
      limit: 1,
      order_by: "id",
      order: "desc",
    });

    expect(data.length).toBeGreaterThan(0);
    const snapshot = data[0];
    expect(snapshot).toBeDefined();
    if (snapshot?.headers) {
      const headers = snapshot.headers as any;
      // Should not include Authorization
      expect(headers.Authorization).toBeUndefined();
      // Should include other headers (case-insensitive check)
      const contentType = headers["Content-Type"] || headers["content-type"];
      expect(contentType).toBe("application/json");
    } else {
      // Headers might be empty object, which is also valid
      expect(snapshot?.headers).toBeDefined();
    }
  });

  it("should capture response status code", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    (context as any).geo = { source: "none" };
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 404;
    };

    await snapshotMiddleware(context, next);

    expect(nextCalled).toBe(true);

    await wait(100);

    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/api/v1/users" },
      limit: 1,
      order_by: "id",
      order: "desc",
    });

    expect(data.length).toBeGreaterThan(0);
    const snapshot = data[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.status_code).toBe(404);
  });

  it("should capture geo information", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    (context as any).geo = {
      source: "header",
      country: "US",
      region: "CA",
      city: "San Francisco",
      lat: 37.7749,
      lon: -122.4194,
    };
    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      (context.res as any).status = 200;
    };

    await snapshotMiddleware(context, next);

    expect(nextCalled).toBe(true);

    await wait(100);

    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/api/v1/users" },
      limit: 1,
      order_by: "id",
      order: "desc",
    });

    expect(data.length).toBeGreaterThan(0);
    const snapshot = data[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.geo_country).toBe("US");
    expect(snapshot?.geo_region).toBe("CA");
    expect(snapshot?.geo_city).toBe("San Francisco");
    expect(snapshot?.geo_lat).toBe(37.7749);
    expect(snapshot?.geo_lon).toBe(-122.4194);
    expect(snapshot?.geo_source).toBe("header");
  });

  it("should handle errors and create error snapshot", async () => {
    const context = createMockContextForMiddleware("GET", "/api/v1/users");
    (context as any).geo = { source: "none" };
    const error = new Error("Test error");

    let nextCalled = false;
    const next = async () => {
      nextCalled = true;
      throw error;
    };

    try {
      await snapshotMiddleware(context, next);
    } catch (e) {
      expect(e).toBe(error);
    }

    expect(nextCalled).toBe(true);

    await wait(100);

    const { data } = await snapshotsQuery.list({
      filters: { path__eq: "/api/v1/users" },
      limit: 1,
      order_by: "id",
      order: "desc",
    });

    expect(data.length).toBeGreaterThan(0);
    const snapshot = data[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.status_code).toBe(500);
  });
});
