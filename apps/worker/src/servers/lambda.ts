import type {
  SQSEvent,
  SQSRecord,
  EventBridgeEvent,
  Context,
} from "aws-lambda";
import { logger } from "@/utils/logger";
import { getJobHandler, hasJobHandler } from "@/jobs/registry";
import { JobType } from "@/jobs/types";
import { SQSQueue } from "@/queue/sqs";
import { StatsPusher } from "@/services/statsPusher";

// Initialize stats pusher at module level for Lambda container reuse
const statsPusher = new StatsPusher();
statsPusher.pushStats().catch((error) => {
  logger.error("Failed to push initial stats in Lambda", { error });
});
statsPusher.startInterval();

interface EventBridgeJobEvent {
  source: "eventbridge";
  jobType: JobType;
  payload: unknown;
}

async function processJob(jobType: JobType, payload: unknown): Promise<void> {
  if (!hasJobHandler(jobType)) {
    throw new Error(`No handler found for job type: ${jobType}`);
  }

  const handler = getJobHandler(jobType);
  if (!handler) {
    throw new Error(`Handler is undefined for job type: ${jobType}`);
  }

  logger.info(`Processing job ${jobType}`, { jobType, payload });
  // Type assertion needed since payload is unknown but handler expects specific type
  await handler(payload as any);
  logger.info(`Completed job ${jobType}`, { jobType });
}

async function handleSQSRecord(record: SQSRecord): Promise<void> {
  try {
    const job = JSON.parse(record.body) as {
      type: JobType;
      payload: unknown;
      receiptHandle?: string;
    };

    await processJob(job.type, job.payload);

    // Push stats after job processing
    await statsPusher.pushStats();

    // Delete message from SQS if we have receipt handle
    if (job.receiptHandle || record.receiptHandle) {
      const queue = new SQSQueue();
      await queue.deleteMessage(job.receiptHandle || record.receiptHandle!);
    }
  } catch (error) {
    logger.error("Failed to process SQS record", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      recordId: record.messageId,
    });
    throw error; // Let Lambda handle retry
  }
}

async function handleEventBridgeEvent(
  event: EventBridgeEvent<"Scheduled Event", EventBridgeJobEvent>
): Promise<void> {
  try {
    const { jobType, payload } = event.detail;
    await processJob(jobType, payload);

    // Push stats after job processing
    await statsPusher.pushStats();
  } catch (error) {
    logger.error("Failed to process EventBridge event", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      eventId: event.id,
    });
    throw error;
  }
}

export const handler = async (
  event: SQSEvent | EventBridgeEvent<"Scheduled Event", EventBridgeJobEvent>,
  context: Context
): Promise<void> => {
  logger.info("Lambda handler invoked", {
    requestId: context.awsRequestId,
    eventSource: "Records" in event ? "sqs" : "eventbridge",
  });

  try {
    // Push stats at the start of invocation (in case no jobs are processed)
    await statsPusher.pushStats();

    // Handle SQS events
    if ("Records" in event && Array.isArray(event.Records)) {
      const sqsEvent = event as SQSEvent;
      await Promise.all(
        sqsEvent.Records.map((record) => handleSQSRecord(record))
      );
      return;
    }

    // Handle EventBridge events
    if ("detail" in event && "source" in event.detail) {
      const ebEvent = event as EventBridgeEvent<
        "Scheduled Event",
        EventBridgeJobEvent
      >;
      await handleEventBridgeEvent(ebEvent);
      return;
    }

    throw new Error("Unknown event type");
  } catch (error) {
    logger.error("Lambda handler error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: context.awsRequestId,
    });
    throw error;
  }
};
