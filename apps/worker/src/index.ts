import type {
  SQSEvent,
  SQSRecord,
  EventBridgeEvent,
  APIGatewayProxyEventV2,
  Context,
} from "aws-lambda";
import { logger } from "@/utils/logger";
import { JobType } from "@/jobs/types";
import { SQSQueue } from "@/utils/sqs";
import { getJobService } from "@/utils/jobService";
import {
  isSQSEvent,
  isEventBridgeEvent,
  isAPIGatewayEvent,
  type EventBridgeJobEvent,
} from "@/utils/events";
import { ensureCronJobsScheduled } from "@/utils/cron";

export const handler = async (
  event:
    | SQSEvent
    | EventBridgeEvent<"Scheduled Event", EventBridgeJobEvent>
    | APIGatewayProxyEventV2,
  context: Context
): Promise<{ statusCode?: number; body?: string } | void> => {
  await ensureCronJobsScheduled();

  try {
    let jobType: JobType;
    let payload: unknown;
    let receiptHandle: string | undefined;
    let maxAttempts: number | undefined;
    let attempts: number | undefined;

    // Extract job from event using type guards
    if (isSQSEvent(event)) {
      // SQS event
      const record = event.Records[0] as SQSRecord;
      const job = JSON.parse(record.body) as {
        type: JobType;
        payload: unknown;
        maxAttempts?: number;
      };
      jobType = job.type;
      payload = job.payload;
      receiptHandle = record.receiptHandle;
      maxAttempts = job.maxAttempts ?? 3;

      // Get receive count from SQS attributes
      // ApproximateReceiveCount is available in Lambda SQS events
      const receiveCount = parseInt(
        record.attributes?.ApproximateReceiveCount || "1",
        10
      );
      attempts = receiveCount - 1; // receiveCount is 1-indexed, attempts is 0-indexed

      // Check if max attempts exceeded
      if (receiveCount > maxAttempts) {
        logger.error(`Job exceeded max attempts, deleting message`, {
          jobType,
          receiveCount,
          maxAttempts,
        });

        // Delete message to prevent further retries
        const queue = new SQSQueue();
        await queue.deleteMessage(receiptHandle);

        // For SQS, we don't return a response, but we've already deleted the message
        // The message will not be retried by SQS since we deleted it
        return;
      }
    } else if (isEventBridgeEvent(event)) {
      // EventBridge event
      const detail = event.detail as EventBridgeJobEvent;
      jobType = detail.jobType;
      payload = detail.payload;
    } else if (isAPIGatewayEvent(event)) {
      // API Gateway event
      const body = JSON.parse(event.body || "{}");
      jobType = body.type;
      payload = body.payload;
    } else {
      throw new Error(
        `Unknown event type: ${JSON.stringify(Object.keys(event))}`
      );
    }

    // Execute job
    const jobService = getJobService();
    const executionOptions = {
      ...(maxAttempts !== undefined && { maxAttempts }),
      ...(attempts !== undefined && { attempts }),
      context: {
        requestId: context.awsRequestId,
      },
    };

    const result = await jobService.execute(jobType, payload, executionOptions);

    // Delete SQS message only on success (no error)
    if (receiptHandle && !result.error) {
      const queue = new SQSQueue();
      await queue.deleteMessage(receiptHandle);
    } else if (receiptHandle && result.error) {
      // Job failed - don't delete message, let SQS retry
      logger.debug(`Job failed, message will be retried by SQS`, {
        jobType,
        attempts,
        maxAttempts,
        error: result.error,
      });
    }

    // Return result for API Gateway
    if (isAPIGatewayEvent(event)) {
      return {
        statusCode: result.error ? 500 : 200,
        body: JSON.stringify(result),
      };
    }

    // SQS/EventBridge - no response needed
    return;
  } catch (error) {
    logger.error("Lambda handler error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: context.awsRequestId,
    });
    throw error;
  }
};
