import env from "@/env";
import { logger } from "@/utils/logger";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// JobType enum - duplicated from worker to avoid circular dependency
export enum JobType {
  PROCESS_METRICS = "PROCESS_METRICS",
  CLEANUP_LOGS = "CLEANUP_LOGS",
  HEALTH_CHECK = "HEALTH_CHECK",
}

let sqsClient: SQSClient | null = null;
let queueUrl: string | null = null;

function getSQSClient(): SQSClient | null {
  if (env.NODE_ENV === "production" || process.env.SQS_QUEUE_URL) {
    if (!sqsClient) {
      sqsClient = new SQSClient({
        region: process.env.AWS_REGION || "us-east-1",
      });
      queueUrl = process.env.SQS_QUEUE_URL || null;
    }
    return sqsClient;
  }
  return null;
}

/**
 * Enqueue a job to the worker queue
 * In production, this sends to SQS
 * In development, this could send to a local queue or HTTP endpoint
 */
export async function enqueueJob<T>(
  jobType: JobType,
  payload: T,
  options?: {
    maxAttempts?: number;
    delay?: number;
    scheduledFor?: Date;
  }
): Promise<string> {
  const client = getSQSClient();

  if (client && queueUrl) {
    // Production: Send to SQS
    const job = {
      id: crypto.randomUUID(),
      type: jobType,
      payload,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      createdAt: new Date().toISOString(),
      scheduledFor: options?.scheduledFor?.toISOString(),
    };

    const delaySeconds = options?.delay
      ? Math.floor(options.delay / 1000)
      : options?.scheduledFor
        ? Math.max(
            0,
            Math.floor((options.scheduledFor.getTime() - Date.now()) / 1000)
          )
        : undefined;

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(job),
      DelaySeconds: delaySeconds ? Math.min(delaySeconds, 900) : undefined,
      MessageAttributes: {
        JobType: {
          DataType: "String",
          StringValue: jobType,
        },
      },
    });

    try {
      const response = await client.send(command);
      logger.debug(`Enqueued job to SQS`, {
        jobType,
        messageId: response.MessageId,
      });
      return job.id;
    } catch (error) {
      logger.error("Failed to enqueue job to SQS", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } else {
    // Development: Log and return job ID
    // In a real implementation, you might want to send to a local HTTP endpoint
    // or use a shared in-memory queue
    const jobId = crypto.randomUUID();
    logger.info(`Would enqueue job (dev mode)`, {
      jobId,
      jobType,
      payload,
      options,
    });
    return jobId;
  }
}

