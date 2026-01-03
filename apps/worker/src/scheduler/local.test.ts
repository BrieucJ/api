import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { LocalScheduler } from "@/scheduler/local";
import { JobType } from "@/jobs/types";

describe("LocalScheduler", () => {
  let scheduler: LocalScheduler;

  beforeEach(() => {
    scheduler = new LocalScheduler();
  });

  afterEach(() => {
    scheduler.stopAll();
  });

  describe("schedule", () => {
    it("should schedule a job and return job ID", async () => {
      const jobId = await scheduler.schedule(
        "*/5 * * * *",
        JobType.HEALTH_CHECK,
        {}
      );
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe("string");
    });

    it("should schedule multiple jobs", async () => {
      const jobId1 = await scheduler.schedule(
        "*/5 * * * *",
        JobType.HEALTH_CHECK,
        {}
      );
      const jobId2 = await scheduler.schedule(
        "0 0 * * *",
        JobType.CLEANUP_LOGS,
        { olderThanDays: 30 }
      );

      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId1).not.toBe(jobId2);
    });

    it("should throw error for invalid cron expression", async () => {
      await expect(
        scheduler.schedule("invalid", JobType.HEALTH_CHECK, {})
      ).rejects.toThrow("Invalid cron expression");
    });

    it("should accept valid cron expressions", async () => {
      const validExpressions = [
        "*/5 * * * *",
        "0 0 * * *",
        "0 */15 * * *",
        "0 0 1 * *",
      ];

      for (const expression of validExpressions) {
        const jobId = await scheduler.schedule(
          expression,
          JobType.HEALTH_CHECK,
          {}
        );
        expect(jobId).toBeDefined();
      }
    });
  });

  describe("unschedule", () => {
    it("should unschedule a job", async () => {
      const jobId = await scheduler.schedule(
        "*/5 * * * *",
        JobType.HEALTH_CHECK,
        {}
      );

      expect(scheduler.list().length).toBe(1);
      await scheduler.unschedule(jobId);
      expect(scheduler.list().length).toBe(0);
    });

    it("should handle unscheduling non-existent job", async () => {
      await scheduler.unschedule("non-existent-id");
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("list", () => {
    it("should return empty list initially", () => {
      const jobs = scheduler.list();
      expect(jobs).toBeInstanceOf(Array);
      expect(jobs.length).toBe(0);
    });

    it("should list all scheduled jobs", async () => {
      const jobId1 = await scheduler.schedule(
        "*/5 * * * *",
        JobType.HEALTH_CHECK,
        {}
      );
      const jobId2 = await scheduler.schedule(
        "0 0 * * *",
        JobType.CLEANUP_LOGS,
        { olderThanDays: 30 }
      );

      const jobs = scheduler.list();
      expect(jobs.length).toBe(2);
      expect(jobs.some((j) => j.id === jobId1)).toBe(true);
      expect(jobs.some((j) => j.id === jobId2)).toBe(true);
    });

    it("should include all job properties in list", async () => {
      await scheduler.schedule("*/5 * * * *", JobType.HEALTH_CHECK, {});

      const jobs = scheduler.list();
      expect(jobs.length).toBe(1);
      const job = jobs[0];
      expect(job?.id).toBeDefined();
      expect(job?.cronExpression).toBe("*/5 * * * *");
      expect(job?.jobType).toBe(JobType.HEALTH_CHECK);
      expect(job?.enabled).toBe(true);
    });
  });

  describe("stopAll", () => {
    it("should stop all scheduled jobs", async () => {
      await scheduler.schedule("*/5 * * * *", JobType.HEALTH_CHECK, {});
      await scheduler.schedule("0 0 * * *", JobType.CLEANUP_LOGS, {});

      expect(scheduler.list().length).toBe(2);
      scheduler.stopAll();
      expect(scheduler.list().length).toBe(0);
    });

    it("should handle stopAll when no jobs are scheduled", () => {
      expect(() => scheduler.stopAll()).not.toThrow();
    });
  });
});

