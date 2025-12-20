import { logger } from "@/utils/logger";
import type { Queue } from "./types";
import type { Job, JobType, JobOptions } from "@/jobs/types";

interface QueuedJob extends Job {
  processing: boolean;
}

export class LocalQueue implements Queue {
  private queue: QueuedJob[] = [];
  private processing: Set<string> = new Set();
  private pollingInterval: number = 1000; // 1 second
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;

  constructor(pollingInterval = 1000) {
    this.pollingInterval = pollingInterval;
  }

  async enqueue<T>(
    jobType: JobType,
    payload: T,
    options?: JobOptions
  ): Promise<string> {
    const job: QueuedJob = {
      id: crypto.randomUUID(),
      type: jobType,
      payload: payload as unknown,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      createdAt: new Date(),
      scheduledFor: options?.scheduledFor,
      processing: false,
    };

    // If there's a delay, calculate scheduledFor
    if (options?.delay && !options.scheduledFor) {
      job.scheduledFor = new Date(Date.now() + options.delay);
    }

    // Insert in order (scheduled jobs go to the end if scheduled for future)
    if (job.scheduledFor && job.scheduledFor > new Date()) {
      // Find insertion point for scheduled jobs
      let insertIndex = this.queue.length;
      for (let i = 0; i < this.queue.length; i++) {
        if (
          this.queue[i]!.scheduledFor &&
          this.queue[i]!.scheduledFor! > job.scheduledFor
        ) {
          insertIndex = i;
          break;
        }
      }
      this.queue.splice(insertIndex, 0, job);
    } else {
      this.queue.push(job);
    }

    logger.debug(`Enqueued job ${job.id} of type ${jobType}`, {
      jobId: job.id,
    });
    return job.id;
  }

  async dequeue(): Promise<Job | null> {
    const now = new Date();

    // Find first available job (not processing, scheduled time passed)
    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i]!;
      if (!job.processing && (!job.scheduledFor || job.scheduledFor <= now)) {
        job.processing = true;
        this.processing.add(job.id);
        this.queue.splice(i, 1);
        return job;
      }
    }

    return null;
  }

  async acknowledge(jobId: string): Promise<void> {
    this.processing.delete(jobId);
    logger.debug(`Acknowledged job ${jobId}`);
  }

  async reject(jobId: string, error?: Error): Promise<void> {
    this.processing.delete(jobId);
    logger.warn(`Rejected job ${jobId}`, {
      error: error?.message,
      stack: error?.stack,
    });
  }

  startPolling(
    onJob: (job: Job) => Promise<void>,
    onError?: (error: Error) => void
  ): void {
    if (this.isPolling) {
      logger.warn("Queue polling already started");
      return;
    }

    this.isPolling = true;
    logger.info("Starting local queue polling", {
      interval: this.pollingInterval,
    });

    const poll = async () => {
      try {
        const job = await this.dequeue();
        if (job) {
          await onJob(job);
        }
      } catch (error) {
        logger.error("Error in queue polling", {
          error: error instanceof Error ? error.message : String(error),
        });
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    };

    // Initial poll
    poll();

    // Set up interval
    this.pollTimer = setInterval(poll, this.pollingInterval);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.isPolling = false;
      logger.info("Stopped local queue polling");
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getProcessingCount(): number {
    return this.processing.size;
  }
}
