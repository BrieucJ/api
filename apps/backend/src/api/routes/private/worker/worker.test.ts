import { describe, it, expect, beforeEach } from "bun:test";
import { workerStats } from "@/db/models/workerStats";
import { createQueryBuilder } from "@/db/querybuilder";
import {
  client,
  createTestUser,
  withTransaction,
} from "@/tests/helpers/test-helpers";
import { resetTestDatabase } from "@/tests/helpers/db-setup";

const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);

describe("Worker API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /worker/stats", () => {
    it(
      "should return most recent worker stats when authenticated",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "worker@test.com",
          "password123",
          "admin"
        );

        // Create test worker stats
        await statsQuery.create({
          worker_mode: "lambda",
          queue_size: 5,
          processing_count: 2,
          scheduled_jobs_count: 3,
          available_jobs_count: 10,
          scheduled_jobs: [],
          available_jobs: [],
        });

        const res = await client["/worker/stats"].$get(
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
        expect(body.data.length).toBe(1); // Handler returns limit 1
        expect(body.metadata).toBeDefined();
        expect(body.metadata.limit).toBe(1);
        expect(body.metadata.offset).toBe(0);
        expect(body.metadata.total).toBeGreaterThanOrEqual(1);

        const stats = body.data[0];
        expect(stats.worker_mode).toBeDefined();
        expect(["local", "lambda"]).toContain(stats.worker_mode);
        expect(stats.queue_size).toBeDefined();
        expect(typeof stats.queue_size).toBe("number");
        expect(stats.processing_count).toBeDefined();
        expect(typeof stats.processing_count).toBe("number");
        expect(stats.scheduled_jobs_count).toBeDefined();
        expect(typeof stats.scheduled_jobs_count).toBe("number");
        expect(stats.available_jobs_count).toBeDefined();
        expect(typeof stats.available_jobs_count).toBe("number");
        expect(stats.last_heartbeat).toBeDefined();
        expect(stats.scheduled_jobs).toBeDefined();
        expect(Array.isArray(stats.scheduled_jobs)).toBe(true);
        expect(stats.available_jobs).toBeDefined();
        expect(Array.isArray(stats.available_jobs)).toBe(true);
      })
    );

    it(
      "should return most recent worker stats when multiple exist",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "worker2@test.com",
          "password123",
          "admin"
        );

        // Create multiple worker stats with different timestamps
        await statsQuery.create({
          worker_mode: "local",
          queue_size: 1,
          processing_count: 1,
          scheduled_jobs_count: 1,
          available_jobs_count: 5,
          scheduled_jobs: [],
          available_jobs: [],
        });

        // Wait a bit to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));

        await statsQuery.create({
          worker_mode: "lambda",
          queue_size: 10,
          processing_count: 5,
          scheduled_jobs_count: 3,
          available_jobs_count: 15,
          scheduled_jobs: [],
          available_jobs: [],
        });

        const res = await client["/worker/stats"].$get(
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.length).toBe(1); // Should return only the most recent
        // Should return the most recent one (ordered by last_heartbeat desc)
        expect(body.data[0].worker_mode).toBe("lambda");
        expect(body.data[0].queue_size).toBe(10);
      })
    );

    it(
      "should return empty array when no stats exist",
      withTransaction(async () => {
        const { token } = await createTestUser(
          "worker3@test.com",
          "password123",
          "admin"
        );

        const res = await client["/worker/stats"].$get(
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
        expect(body.data.length).toBe(0);
        expect(body.metadata.total).toBe(0);
      })
    );

    it(
      "should return unauthorized when not authenticated",
      withTransaction(async () => {
        const res = await client["/worker/stats"].$get();

        expect(res.status).toBe(401);
      })
    );
  });
});
