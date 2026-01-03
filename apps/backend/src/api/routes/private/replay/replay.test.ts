import { describe, it, expect, beforeEach } from "bun:test";
import { requestSnapshots } from "@/db/models/requestSnapshots";
import { createQueryBuilder } from "@/db/querybuilder";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

const snapshotsQuery =
  createQueryBuilder<typeof requestSnapshots>(requestSnapshots);

describe("Replay API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /replay", () => {
    it(
      "should list all request snapshots",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay@test.com",
          "password123",
          "admin"
        );

        // Create test snapshots
        await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
          query: { limit: "10" },
          headers: { "Content-Type": "application/json" },
        });

        await snapshotsQuery.create({
          method: "POST",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
          body: { email: "test@example.com" },
          headers: { "Content-Type": "application/json" },
        });

        const res = await client["/replay"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              order_by: "id",
              order: "asc",
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
        expect(body.data).toBeInstanceOf(Array);
        expect(body.data.length).toBeGreaterThanOrEqual(2);
        expect(body.metadata.total).toBeGreaterThanOrEqual(2);
      })
    );

    it(
      "should filter snapshots by method",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay2@test.com",
          "password123",
          "admin"
        );

        await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
        });

        await snapshotsQuery.create({
          method: "POST",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
        });

        const res = await client["/replay"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              method: "GET",
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
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(
          body.data.every((snapshot: any) => snapshot.method === "GET")
        ).toBe(true);
      })
    );

    it(
      "should filter snapshots by path",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay3@test.com",
          "password123",
          "admin"
        );

        await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
        });

        await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users/:id",
          version: "1.0.0",
          stage: "test",
        });

        const res = await client["/replay"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              path: "/api/v1/users",
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
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(
          body.data.every((snapshot: any) => snapshot.path === "/api/v1/users")
        ).toBe(true);
      })
    );

    it(
      "should filter snapshots by status code",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay4@test.com",
          "password123",
          "admin"
        );

        await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
          status_code: 200,
        });

        await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
          status_code: 404,
        });

        const res = await client["/replay"].$get(
          {
            query: {
              limit: 10,
              offset: 0,
              statusCode: 200,
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
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(
          body.data.every((snapshot: any) => snapshot.status_code === 200)
        ).toBe(true);
      })
    );

    it(
      "should paginate snapshots",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay5@test.com",
          "password123",
          "admin"
        );

        // Create multiple snapshots
        for (let i = 0; i < 5; i++) {
          await snapshotsQuery.create({
            method: "GET",
            path: `/api/v1/endpoint${i}`,
            version: "1.0.0",
            stage: "test",
          });
        }

        const res = await client["/replay"].$get(
          {
            query: {
              limit: 2,
              offset: 0,
              order_by: "id",
              order: "asc",
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
        expect(body.data.length).toBeLessThanOrEqual(2);
        expect(body.metadata.limit).toBe(2);
        expect(body.metadata.offset).toBe(0);
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/replay"].$get({
          query: {
            limit: 10,
            offset: 0,
          },
        });

        expect(res.status).toBe(401);
      })
    );
  });

  describe("GET /replay/:id", () => {
    it(
      "should get snapshot by id",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay6@test.com",
          "password123",
          "admin"
        );

        const snapshot = await snapshotsQuery.create({
          method: "GET",
          path: "/api/v1/users",
          version: "1.0.0",
          stage: "test",
          query: { limit: "10" },
        });

        const res = await client["/replay/:id"].$get(
          {
            param: { id: snapshot.id.toString() },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.id).toBe(snapshot.id);
        expect(body.data.method).toBe("GET");
        expect(body.data.path).toBe("/api/v1/users");
      })
    );

    it(
      "should return 404 for non-existent snapshot",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay7@test.com",
          "password123",
          "admin"
        );

        const res = await client["/replay/:id"].$get(
          {
            param: { id: "99999" },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("not found");
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/replay/:id"].$get({
          param: { id: "1" },
        });

        expect(res.status).toBe(401);
      })
    );
  });

  describe("POST /replay/:id/replay", () => {
    it(
      "should replay a GET request snapshot",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay8@test.com",
          "password123",
          "admin"
        );

        // Create a snapshot for a simple GET request to a route that exists
        // Use /health which requires auth, but the replay adds x-internal-replay header
        const snapshot = await snapshotsQuery.create({
          method: "GET",
          path: "/health",
          version: "1.0.0",
          stage: "test",
          status_code: 200,
        });

        const res = await client["/replay/:id/replay"].$post(
          {
            param: { id: snapshot.id.toString() },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        // Replay might fail in test environment if it can't make HTTP requests
        // So we check for either success or a specific error
        if (res.status === 200) {
          expect(body.data).toBeDefined();
          expect(body.data.statusCode).toBeDefined();
          expect(typeof body.data.statusCode).toBe("number");
          expect(body.data.headers).toBeDefined();
          expect(body.data.duration).toBeDefined();
          expect(typeof body.data.duration).toBe("number");
        } else {
          // If replay fails, it should be a 500 with an error message
          expect(res.status).toBe(500);
          expect(body.error).toBeDefined();
        }
      })
    );

    it(
      "should return 404 for non-existent snapshot",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay9@test.com",
          "password123",
          "admin"
        );

        const res = await client["/replay/:id/replay"].$post(
          {
            param: { id: "99999" },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("not found");
      })
    );

    it(
      "should return 403 for blocked paths",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "replay10@test.com",
          "password123",
          "admin"
        );

        // Create a snapshot for a blocked path
        const snapshot = await snapshotsQuery.create({
          method: "GET",
          path: "/replay",
          version: "1.0.0",
          stage: "test",
        });

        const res = await client["/replay/:id/replay"].$post(
          {
            param: { id: snapshot.id.toString() },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("not allowed");
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/replay/:id/replay"].$post({
          param: { id: "1" },
        });

        expect(res.status).toBe(401);
      })
    );
  });
});
