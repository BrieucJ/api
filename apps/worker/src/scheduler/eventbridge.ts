import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import { logger } from "@/utils/logger";
import env from "@/env";
import type { Scheduler, CronJob } from "./types";
import type { JobType } from "@/jobs/types";

export class EventBridgeScheduler implements Scheduler {
  private client: EventBridgeClient;
  private rulePrefix: string;
  private lambdaArn: string;

  constructor(lambdaArn: string, rulePrefix = "worker-cron") {
    this.lambdaArn = lambdaArn;
    this.rulePrefix = rulePrefix;
    this.client = new EventBridgeClient({
      region: env.AWS_REGION || "us-east-1",
    });
  }

  async schedule(
    cronExpression: string,
    jobType: JobType,
    payload: unknown
  ): Promise<string> {
    const ruleName = `${this.rulePrefix}-${crypto.randomUUID()}`;

    // Convert cron expression to EventBridge schedule expression
    // EventBridge uses rate() or cron() expressions
    const scheduleExpression = this.cronToEventBridge(cronExpression);

    try {
      // Create the rule
      const putRuleCommand = new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: scheduleExpression,
        State: "ENABLED",
        Description: `Scheduled job: ${jobType}`,
      });

      await this.client.send(putRuleCommand);

      // Add Lambda as target
      const putTargetsCommand = new PutTargetsCommand({
        Rule: ruleName,
        Targets: [
          {
            Id: "1",
            Arn: this.lambdaArn,
            Input: JSON.stringify({
              source: "eventbridge",
              jobType,
              payload,
            }),
          },
        ],
      });

      await this.client.send(putTargetsCommand);

      logger.info(`Scheduled job in EventBridge`, {
        ruleName,
        jobType,
        scheduleExpression,
      });

      return ruleName;
    } catch (error) {
      logger.error("Failed to schedule job in EventBridge", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async unschedule(jobId: string): Promise<void> {
    try {
      // Remove targets first
      const removeTargetsCommand = new RemoveTargetsCommand({
        Rule: jobId,
        Ids: ["1"],
      });
      await this.client.send(removeTargetsCommand);

      // Delete the rule
      const deleteRuleCommand = new DeleteRuleCommand({
        Name: jobId,
      });
      await this.client.send(deleteRuleCommand);

      logger.info(`Unscheduled job in EventBridge`, { jobId });
    } catch (error) {
      logger.error("Failed to unschedule job in EventBridge", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  list(): CronJob[] {
    // EventBridge doesn't provide a simple way to list all rules with their targets
    // This would require additional API calls to get rule details
    // For now, return empty array - this can be enhanced later
    logger.warn("EventBridge scheduler list() not fully implemented");
    return [];
  }

  private cronToEventBridge(cronExpression: string): string {
    // EventBridge cron format: cron(minute hour day-of-month month day-of-week year)
    // Standard cron: minute hour day-of-month month day-of-week
    // We need to add year as * for EventBridge
    const parts = cronExpression.split(" ");
    if (parts.length === 5) {
      return `cron(${cronExpression} *)`;
    }
    // If already in EventBridge format, return as is
    return cronExpression;
  }
}
