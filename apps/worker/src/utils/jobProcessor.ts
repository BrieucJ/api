import { logger } from "@/utils/logger";
import { getJobHandler, getJobDefinition } from "@/jobs";
import { getQueue } from "@/services/queue";
import type { Job, JobType } from "@/jobs/types";

export async function processJob(job: Job): Promise<void> {
  const { type, payload, attempts, maxAttempts, id } = job;

  if (attempts >= maxAttempts) {
    logger.error(`Job ${id} exceeded max attempts`, {
      jobId: id,
      type,
      attempts,
      maxAttempts,
    });
    return;
  }

  const definition = getJobDefinition(type);
  if (!definition) {
    throw new Error(`No job definition found for type: ${type}`);
  }

  // Validate payload
  const validatedPayload = definition.payloadSchema.parse(payload);

  const handler = getJobHandler(type);
  if (!handler) {
    throw new Error(`No handler found for job type: ${type}`);
  }

  logger.info(`Processing job ${id}`, {
    jobId: id,
    type,
    attempts: attempts + 1,
  });

  try {
    await handler(validatedPayload);
    logger.info(`Completed job ${id}`, {
      jobId: id,
      type,
    });
  } catch (error) {
    logger.error(`Failed to process job ${id}`, {
      jobId: id,
      type,
      attempts: attempts + 1,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Retry logic
    if (attempts + 1 < maxAttempts) {
      // Exponential backoff: 2^attempts seconds
      const delay = Math.pow(2, attempts) * 1000;
      const queue = getQueue();
      await queue.enqueue(type, payload, {
        delay,
        maxAttempts,
      });

      logger.info(`Scheduled retry for job ${id}`, {
        jobId: id,
        type,
        attempts: attempts + 1,
        delay,
      });
    } else {
      logger.error(`Job ${id} failed after ${maxAttempts} attempts`, {
        jobId: id,
        type,
        maxAttempts,
      });
    }
    throw error;
  }
}

// Simple processor for direct job type + payload (used by Lambda/EventBridge)
export async function processJobDirect(
  jobType: JobType,
  payload: unknown
): Promise<void> {
  const definition = getJobDefinition(jobType);
  if (!definition) {
    throw new Error(`No job definition found for type: ${jobType}`);
  }

  // Validate payload
  const validatedPayload = definition.payloadSchema.parse(payload);

  const handler = getJobHandler(jobType);
  if (!handler) {
    throw new Error(`No handler found for job type: ${jobType}`);
  }

  logger.info(`Processing job ${jobType}`, {
    jobType,
    payload: validatedPayload,
  });

  try {
    await handler(validatedPayload);
    logger.info(`Completed job ${jobType}`, { jobType });
  } catch (error) {
    logger.error(`Failed to process job ${jobType}`, {
      jobType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
