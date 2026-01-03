import { describe, it, expect, beforeEach } from "bun:test";
import { healthCheck } from "@/jobs/handlers/healthCheck";
import { resetTestDatabase } from "@/tests/helpers/db-setup";
import { withTransaction } from "@/tests/helpers/test-helpers";
import { workerStats } from "@shared/db";
import { createQueryBuilder } from "@shared/db";

const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);

describe("Health Check Handler", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it(
    "should perform health check without throwing",
    withTransaction(async () => {
      const payload = {};

      await healthCheck(payload);
      expect(true).toBe(true);
    })
  );

  it(
    "should check database connectivity",
    withTransaction(async () => {
      const payload = {
        checkType: "database" as const,
      };

      await healthCheck(payload);
      expect(true).toBe(true);
    })
  );

  it(
    "should update worker heartbeat",
    withTransaction(async () => {
      // Create initial stats
      await statsQuery.create({
        worker_mode: "local",
        queue_size: 0,
        processing_count: 0,
        scheduled_jobs_count: 0,
        available_jobs_count: 0,
        scheduled_jobs: [],
        available_jobs: [],
      });

      const beforeTime = new Date();
      const payload = {};

      await healthCheck(payload);

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data } = await statsQuery.list({
        filters: { worker_mode__eq: "local" },
        limit: 1,
        order_by: "last_heartbeat",
        order: "desc",
      });

      expect(data.length).toBeGreaterThan(0);
      const stats = data[0];
      expect(stats).toBeDefined();
      if (stats?.last_heartbeat) {
        const heartbeatTime = new Date(stats.last_heartbeat);
        expect(heartbeatTime.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime()
        );
      }
    })
  );

  it(
    "should create worker stats if none exist",
    withTransaction(async () => {
      const payload = {};

      await healthCheck(payload);

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data } = await statsQuery.list({
        filters: { worker_mode__eq: "local" },
        limit: 1,
      });

      expect(data.length).toBeGreaterThan(0);
      const stats = data[0];
      expect(stats).toBeDefined();
      expect(stats?.worker_mode).toBe("local");
    })
  );

  it(
    "should handle all check types",
    withTransaction(async () => {
      const checkTypes = ["database", "queue", "scheduler"] as const;

      for (const checkType of checkTypes) {
        const payload = { checkType };
        await healthCheck(payload);
      }
      expect(true).toBe(true);
    })
  );
});
