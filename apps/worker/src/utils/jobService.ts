import { logger } from "@/utils/logger";
import { getJobHandler, getJobDefinition } from "@/jobs";
import { JobType } from "@/jobs/types";
import type { JobOptions } from "@/jobs/types";
import type {
  JobResult,
  JobExecutionOptions,
  JobResultMetadata,
} from "./types";

export class JobService {
  /**
   * Execute a job with typed result
   */
  async execute<T = unknown>(
    jobType: JobType,
    payload: unknown,
    options?: JobExecutionOptions
  ): Promise<JobResult<T>> {
    const startTime = Date.now();
    const jobId = options?.jobId || crypto.randomUUID();
    const attempts = options?.attempts || 0;
    const maxAttempts = options?.maxAttempts || 3;

    // Check if max attempts exceeded
    if (attempts >= maxAttempts) {
      logger.error(`Job ${jobId} exceeded max attempts`, {
        jobId,
        jobType,
        attempts,
        maxAttempts,
      });

      const definition = getJobDefinition(jobType);
      return {
        data: null,
        error: `Job exceeded max attempts (${maxAttempts})`,
        metadata: {
          jobType,
          jobName: definition?.name || jobType,
          executionTime: Date.now() - startTime,
          attempts,
          maxAttempts,
          jobId,
        },
      };
    }

    const definition = getJobDefinition(jobType);
    if (!definition) {
      const error = `No job definition found for type: ${jobType}`;
      logger.error(error, { jobId, jobType });
      return {
        data: null,
        error,
        metadata: {
          jobType,
          jobName: jobType,
          executionTime: Date.now() - startTime,
          attempts,
          maxAttempts,
          jobId,
        },
      };
    }

    // Validate payload
    let validatedPayload: unknown;
    try {
      validatedPayload = definition.payloadSchema.parse(payload);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Invalid payload";
      logger.error(`Payload validation failed for job ${jobId}`, {
        jobId,
        jobType,
        error: errorMessage,
      });
      return {
        data: null,
        error: `Payload validation failed: ${errorMessage}`,
        metadata: {
          jobType,
          jobName: definition.name,
          executionTime: Date.now() - startTime,
          attempts,
          maxAttempts,
          jobId,
        },
      };
    }

    const handler = getJobHandler(jobType);
    if (!handler) {
      const error = `No handler found for job type: ${jobType}`;
      logger.error(error, { jobId, jobType });
      return {
        data: null,
        error,
        metadata: {
          jobType,
          jobName: definition.name,
          executionTime: Date.now() - startTime,
          attempts,
          maxAttempts,
          jobId,
        },
      };
    }

    logger.info(`Processing job ${jobId}`, {
      jobId,
      jobType,
      attempts: attempts + 1,
    });

    try {
      const result = await handler(validatedPayload);
      const executionTime = Date.now() - startTime;

      // Validate result (resultSchema is always required)
      let validatedResult: T;
      try {
        validatedResult = definition.resultSchema.parse(result) as T;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Invalid result format";
        logger.error(`Result validation failed for job ${jobId}`, {
          jobId,
          jobType,
          error: errorMessage,
        });
        return {
          data: null,
          error: `Result validation failed: ${errorMessage}`,
          metadata: {
            jobType,
            jobName: definition.name,
            executionTime,
            attempts: attempts + 1,
            maxAttempts,
            jobId,
          },
        };
      }

      logger.info(`Completed job ${jobId}`, {
        jobId,
        jobType,
        executionTime,
      });

      // Build metadata with job-specific information
      const metadata: JobResultMetadata = {
        jobType,
        jobName: definition.name,
        executionTime,
        attempts: attempts + 1,
        maxAttempts,
        jobId,
        // Include result data in metadata if it's an object with useful info
        ...(typeof result === "object" &&
        result !== null &&
        !Array.isArray(result)
          ? result
          : {}),
      };

      return {
        data: validatedResult,
        error: null,
        metadata,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Failed to process job ${jobId}`, {
        jobId,
        jobType,
        attempts: attempts + 1,
        maxAttempts,
        error: errorMessage,
        stack: errorStack,
      });

      return {
        data: null,
        error: errorMessage,
        metadata: {
          jobType,
          jobName: definition.name,
          executionTime: Date.now() - startTime,
          attempts: attempts + 1,
          maxAttempts,
          jobId,
        },
      };
    }
  }
}

// Export singleton instance
let jobServiceInstance: JobService | null = null;

export function getJobService(): JobService {
  if (!jobServiceInstance) {
    jobServiceInstance = new JobService();
  }
  return jobServiceInstance;
}
