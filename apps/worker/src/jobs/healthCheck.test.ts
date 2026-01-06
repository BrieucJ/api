import { describe, it, expect, beforeEach } from "bun:test";
import { getJobService } from "@/utils/jobService";
import { JobType } from "@/jobs/types";
import { resetTestDatabase } from "@shared/utils";
import { withTransaction } from "@shared/utils";
import { workerStats } from "@shared/db";
import { createQueryBuilder } from "@shared/db";
import type { JobResult } from "@/utils/types";

const statsQuery = createQueryBuilder<typeof workerStats>(workerStats);

describe("Health Check Handler", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it(
    "should perform health check without throwing",
    withTransaction(async () => {
      const payload = {};

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.HEALTH_CHECK,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.jobType).toBe(JobType.HEALTH_CHECK);
      expect(result.metadata.jobId).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    })
  );

  it(
    "should check database connectivity",
    withTransaction(async () => {
      const payload = {
        checkType: "database" as const,
      };

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.HEALTH_CHECK,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.jobType).toBe(JobType.HEALTH_CHECK);
    })
  );

  it(
    "should update worker heartbeat",
    withTransaction(async () => {
      // Create initial stats
      await statsQuery.create({
        queue_size: 0,
        processing_count: 0,
        scheduled_jobs_count: 0,
        available_jobs_count: 0,
        scheduled_jobs: [],
        available_jobs: [],
      });

      const beforeTime = new Date();
      const payload = {};

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.HEALTH_CHECK,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data } = await statsQuery.list({
        limit: 1,
        order_by: { field: "last_heartbeat", order: "desc" },
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

      const jobService = getJobService();
      const result: JobResult = await jobService.execute(
        JobType.HEALTH_CHECK,
        payload
      );

      // Verify return type structure
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("metadata");
      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.metadata).toBeDefined();

      // Wait a bit for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { data } = await statsQuery.list({
        limit: 1,
      });

      expect(data.length).toBeGreaterThan(0);
      const stats = data[0];
      expect(stats).toBeDefined();
      expect(stats?.last_heartbeat).toBeDefined();
    })
  );

  it(
    "should handle all check types",
    withTransaction(async () => {
      const checkTypes = ["database", "queue", "scheduler"] as const;

      for (const checkType of checkTypes) {
        const payload = { checkType };
        const jobService = getJobService();
        const result: JobResult = await jobService.execute(
          JobType.HEALTH_CHECK,
          payload
        );

        // Verify return type structure
        expect(result).toHaveProperty("data");
        expect(result).toHaveProperty("error");
        expect(result).toHaveProperty("metadata");
        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.metadata).toBeDefined();
      }
    })
  );
});
