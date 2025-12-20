import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { logger } from "@/utils/logger";
import env from "@/env";
import type { Queue } from "./types";
import type { Job, JobType, JobOptions } from "@/jobs/types";

export class SQSQueue implements Queue {
  private client: SQSClient;
  private queueUrl: string;
  private visibilityTimeout: number = 300; // 5 minutes

  constructor(queueUrl?: string) {
    this.queueUrl = queueUrl || env.SQS_QUEUE_URL || "";
    if (!this.queueUrl) {
      throw new Error("SQS_QUEUE_URL is required for SQS queue");
    }

    this.client = new SQSClient({
      region: env.AWS_REGION || "us-east-1",
    });
  }

  async enqueue<T>(
    jobType: JobType,
    payload: T,
    options?: JobOptions
  ): Promise<string> {
    const job: Job = {
      id: crypto.randomUUID(),
      type: jobType,
      payload: payload as unknown,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      createdAt: new Date(),
      scheduledFor: options?.scheduledFor,
    };

    const messageBody = JSON.stringify(job);

    const delaySeconds = options?.delay
      ? Math.floor(options.delay / 1000)
      : options?.scheduledFor
      ? Math.max(
          0,
          Math.floor((options.scheduledFor.getTime() - Date.now()) / 1000)
        )
      : undefined;

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: messageBody,
      DelaySeconds: delaySeconds ? Math.min(delaySeconds, 900) : undefined, // SQS max delay is 15 minutes
      MessageAttributes: {
        JobType: {
          DataType: "String",
          StringValue: jobType,
        },
      },
    });

    try {
      const response = await this.client.send(command);
      logger.debug(`Enqueued job ${job.id} to SQS`, {
        jobId: job.id,
        messageId: response.MessageId,
      });
      return job.id;
    } catch (error) {
      logger.error("Failed to enqueue job to SQS", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async dequeue(): Promise<Job | null> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 1,
      VisibilityTimeout: this.visibilityTimeout,
      WaitTimeSeconds: 20, // Long polling
    });

    try {
      const response = await this.client.send(command);
      if (!response.Messages || response.Messages.length === 0) {
        return null;
      }

      const message = response.Messages[0]!;
      const job = JSON.parse(message.Body || "{}") as Job;

      // Store receipt handle for acknowledgment
      (job as any).receiptHandle = message.ReceiptHandle;

      logger.debug(`Dequeued job ${job.id} from SQS`, { jobId: job.id });
      return job;
    } catch (error) {
      logger.error("Failed to dequeue job from SQS", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async acknowledge(jobId: string): Promise<void> {
    // In SQS, we need the receipt handle from the job
    // This is handled in the processJob function
    logger.debug(`Acknowledged job ${jobId} in SQS`);
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      logger.error("Failed to delete message from SQS", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async reject(jobId: string, error?: Error): Promise<void> {
    // In SQS, rejection means the message will become visible again after visibility timeout
    // For DLQ handling, we rely on SQS redrive policy
    logger.warn(`Rejected job ${jobId} in SQS`, {
      error: error?.message,
      stack: error?.stack,
    });
  }
}
