import { describe, it, expect, beforeEach } from "bun:test";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import { modelMetadata } from "./admin.models";

describe("Admin API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /admin/models", () => {
    it(
      "should list all available models",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/models"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeInstanceOf(Array);
        expect(body.data.length).toBeGreaterThan(0);
        expect(body.error).toBeNull();
        expect(body.metadata).toBeNull();

        // Verify structure of model objects
        const model = body.data[0];
        expect(model).toHaveProperty("name");
        expect(model).toHaveProperty("displayName");
        expect(model).toHaveProperty("pluralName");
        expect(model).toHaveProperty("basePath");
        expect(model).toHaveProperty("canCreate");
        expect(model).toHaveProperty("canEdit");
        expect(model).toHaveProperty("canDelete");

        // Verify all expected models are present
        const modelNames = body.data.map((m: any) => m.name);
        const expectedModels = Object.keys(modelMetadata);
        for (const expectedModel of expectedModels) {
          expect(modelNames).toContain(expectedModel);
        }
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/admin/models"].$get({});

        expect(res.status).toBe(401);
      })
    );
  });

  describe("GET /admin/schema/{modelName}", () => {
    it(
      "should get schema for users model",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin2@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/users"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe("users");
        expect(body.data.displayName).toBe("User");
        expect(body.data.fields).toBeInstanceOf(Array);
        expect(body.error).toBeNull();
        expect(body.metadata).toBeNull();

        // Verify field structure
        const field = body.data.fields[0];
        expect(field).toHaveProperty("name");
        expect(field).toHaveProperty("label");
        expect(field).toHaveProperty("type");
        expect(field).toHaveProperty("required");
        expect(field).toHaveProperty("readonly");

        // Verify specific fields exist
        const fieldNames = body.data.fields.map((f: any) => f.name);
        expect(fieldNames).toContain("email");
        expect(fieldNames).toContain("role");
        expect(fieldNames).toContain("id");
        expect(fieldNames).toContain("created_at");
        expect(fieldNames).toContain("updated_at");

        // Verify sensitive fields are excluded
        expect(fieldNames).not.toContain("password_hash");
        expect(fieldNames).not.toContain("deleted_at");
      })
    );

    it(
      "should get schema for logs model",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin3@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/logs"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe("logs");
        expect(body.data.displayName).toBe("Log");
        expect(body.data.fields).toBeInstanceOf(Array);

        // Verify log-specific fields
        const fieldNames = body.data.fields.map((f: any) => f.name);
        expect(fieldNames).toContain("source");
        expect(fieldNames).toContain("level");
        expect(fieldNames).toContain("message");
        expect(fieldNames).toContain("meta");
      })
    );

    it(
      "should get schema for metrics model",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin4@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/metrics"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe("metrics");
        expect(body.data.displayName).toBe("Metric");

        // Verify metrics-specific fields
        const fieldNames = body.data.fields.map((f: any) => f.name);
        expect(fieldNames).toContain("endpoint");
        expect(fieldNames).toContain("window_start");
        expect(fieldNames).toContain("window_end");
        expect(fieldNames).toContain("p50_latency");
        expect(fieldNames).toContain("p95_latency");
        expect(fieldNames).toContain("p99_latency");
        expect(fieldNames).toContain("error_rate");
        expect(fieldNames).toContain("traffic_count");
      })
    );

    it(
      "should return 404 for non-existent model",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin5@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/nonexistent"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.data).toBeDefined();
        expect(body.data.message).toContain("nonexistent");
        expect(body.error).toBeNull();
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/admin/schema/users"].$get({});

        expect(res.status).toBe(401);
      })
    );

    it(
      "should handle request_snapshots model name",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin6@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/request_snapshots"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe("request_snapshots");
        expect(body.data.displayName).toBe("Request Snapshot");
      })
    );

    it(
      "should handle refresh_tokens model name",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin7@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/refresh_tokens"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe("refresh_tokens");
        expect(body.data.displayName).toBe("Refresh Token");
      })
    );

    it(
      "should handle worker_stats model name",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "admin8@test.com",
          "password123",
          "admin"
        );

        const res = await client["/admin/schema/worker_stats"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe("worker_stats");
        expect(body.data.displayName).toBe("Worker Stat");
      })
    );
  });
});
