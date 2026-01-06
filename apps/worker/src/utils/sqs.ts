import {
  SQSClient,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { logger } from "@/utils/logger";
import env from "@/env";

export class SQSQueue {
  private client: SQSClient;
  private queueUrl: string;

  constructor(queueUrl?: string) {
    this.queueUrl = queueUrl || env.SQS_QUEUE_URL || "";
    if (!this.queueUrl) {
      throw new Error("SQS_QUEUE_URL is required for SQS queue");
    }

    this.client = new SQSClient({
      region: env.REGION,
    });
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

  async getQueueSize(): Promise<number> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      });

      const response = await this.client.send(command);
      const approximateMessages =
        response.Attributes?.ApproximateNumberOfMessages;
      return approximateMessages ? parseInt(approximateMessages, 10) : 0;
    } catch (error) {
      logger.error("Failed to get queue size from SQS", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0; // Return 0 on error to not break health check
    }
  }
}
