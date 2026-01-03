import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { LocalQueue } from "@/queue/local";
import { JobType } from "@/jobs/types";

describe("LocalQueue", () => {
  let queue: LocalQueue;

  beforeEach(() => {
    queue = new LocalQueue(100); // Fast polling for tests
  });

  afterEach(() => {
    queue.stopPolling();
  });

  describe("enqueue", () => {
    it("should enqueue a job and return job ID", async () => {
      const jobId = await queue.enqueue(JobType.HEALTH_CHECK, {});
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe("string");
      expect(queue.getQueueSize()).toBe(1);
    });

    it("should enqueue multiple jobs", async () => {
      await queue.enqueue(JobType.HEALTH_CHECK, {});
      await queue.enqueue(JobType.CLEANUP_LOGS, { olderThanDays: 30 });
      await queue.enqueue(JobType.PROCESS_METRICS, {
        windowStart: new Date().toISOString(),
        windowEnd: new Date().toISOString(),
      });

      expect(queue.getQueueSize()).toBe(3);
    });

    it("should handle job with delay", async () => {
      const jobId = await queue.enqueue(
        JobType.HEALTH_CHECK,
        {},
        { delay: 1000 }
      );
      expect(jobId).toBeDefined();
      expect(queue.getQueueSize()).toBe(1);
    });

    it("should handle job with scheduledFor", async () => {
      const futureDate = new Date(Date.now() + 5000);
      const jobId = await queue.enqueue(
        JobType.HEALTH_CHECK,
        {},
        { scheduledFor: futureDate }
      );
      expect(jobId).toBeDefined();
      expect(queue.getQueueSize()).toBe(1);
    });
  });

  describe("dequeue", () => {
    it("should return null when queue is empty", async () => {
      const job = await queue.dequeue();
      expect(job).toBeNull();
    });

    it("should dequeue a job", async () => {
      const jobId = await queue.enqueue(JobType.HEALTH_CHECK, {});
      const job = await queue.dequeue();

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.type).toBe(JobType.HEALTH_CHECK);
      expect(queue.getQueueSize()).toBe(0);
      expect(queue.getProcessingCount()).toBe(1);
    });

    it("should not dequeue scheduled jobs before their time", async () => {
      const futureDate = new Date(Date.now() + 5000);
      await queue.enqueue(
        JobType.HEALTH_CHECK,
        {},
        { scheduledFor: futureDate }
      );

      const job = await queue.dequeue();
      expect(job).toBeNull();
      expect(queue.getQueueSize()).toBe(1);
    });

    it("should dequeue scheduled jobs after their time", async () => {
      const pastDate = new Date(Date.now() - 1000);
      const jobId = await queue.enqueue(
        JobType.HEALTH_CHECK,
        {},
        { scheduledFor: pastDate }
      );

      const job = await queue.dequeue();
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });
  });

  describe("acknowledge", () => {
    it("should acknowledge a job", async () => {
      const jobId = await queue.enqueue(JobType.HEALTH_CHECK, {});
      await queue.dequeue();

      expect(queue.getProcessingCount()).toBe(1);
      await queue.acknowledge(jobId);
      expect(queue.getProcessingCount()).toBe(0);
    });
  });

  describe("reject", () => {
    it("should reject a job", async () => {
      const jobId = await queue.enqueue(JobType.HEALTH_CHECK, {});
      await queue.dequeue();

      expect(queue.getProcessingCount()).toBe(1);
      await queue.reject(jobId, new Error("Test error"));
      expect(queue.getProcessingCount()).toBe(0);
    });
  });

  describe("polling", () => {
    it("should start polling and process jobs", async () => {
      let processedJob: any = null;

      await queue.enqueue(JobType.HEALTH_CHECK, {});
      queue.startPolling(async (job) => {
        processedJob = job;
      });

      // Wait for polling to process the job
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(processedJob).toBeDefined();
      expect(processedJob?.type).toBe(JobType.HEALTH_CHECK);
    });

    it("should stop polling", () => {
      queue.startPolling(async () => {});
      expect(() => queue.stopPolling()).not.toThrow();
    });

    it("should not start polling twice", () => {
      queue.startPolling(async () => {});
      queue.startPolling(async () => {}); // Should not throw or start again
      queue.stopPolling();
    });
  });

  describe("queue size and processing count", () => {
    it("should track queue size correctly", async () => {
      expect(queue.getQueueSize()).toBe(0);
      await queue.enqueue(JobType.HEALTH_CHECK, {});
      expect(queue.getQueueSize()).toBe(1);
      await queue.dequeue();
      expect(queue.getQueueSize()).toBe(0);
    });

    it("should track processing count correctly", async () => {
      expect(queue.getProcessingCount()).toBe(0);
      const jobId = await queue.enqueue(JobType.HEALTH_CHECK, {});
      await queue.dequeue();
      expect(queue.getProcessingCount()).toBe(1);
      await queue.acknowledge(jobId);
      expect(queue.getProcessingCount()).toBe(0);
    });
  });
});

