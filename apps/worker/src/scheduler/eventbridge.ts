import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  LambdaClient,
  AddPermissionCommand,
  RemovePermissionCommand,
} from "@aws-sdk/client-lambda";
import { logger } from "@/utils/logger";
import env from "@/env";
import type { Scheduler, CronJob } from "./types";
import type { JobType } from "@/jobs/types";

export class EventBridgeScheduler implements Scheduler {
  private eventBridgeClient: EventBridgeClient;
  private lambdaClient: LambdaClient;
  private rulePrefix: string;
  private lambdaArn: string;
  private lambdaFunctionName: string;

  constructor(lambdaArn: string, rulePrefix = "worker-cron") {
    this.lambdaArn = lambdaArn;
    this.rulePrefix = rulePrefix;
    // Extract function name from ARN
    this.lambdaFunctionName = lambdaArn.split(":").pop() || "";
    this.eventBridgeClient = new EventBridgeClient({
      region: env.REGION,
    });
    this.lambdaClient = new LambdaClient({
      region: env.REGION,
    });
  }

  async schedule(
    cronExpression: string,
    jobType: JobType,
    payload: unknown
  ): Promise<string> {
    // Use deterministic rule name based on job type (prevents duplicates)
    const ruleName = `${this.rulePrefix}-${jobType}`;

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

      const putRuleResponse = await this.eventBridgeClient.send(putRuleCommand);
      const ruleArn = putRuleResponse.RuleArn!;

      // Add Lambda permission for this specific rule (idempotent)
      try {
        const addPermissionCommand = new AddPermissionCommand({
          FunctionName: this.lambdaFunctionName,
          StatementId: `${ruleName}`,
          Action: "lambda:InvokeFunction",
          Principal: "events.amazonaws.com",
          SourceArn: ruleArn,
        });
        await this.lambdaClient.send(addPermissionCommand);
        logger.info("Added Lambda permission for rule", { ruleName, ruleArn });
      } catch (error: any) {
        // Permission already exists - this is fine, it means the rule was recreated
        if (error.name === "ResourceConflictException") {
          logger.debug("Lambda permission already exists", { ruleName });
        } else {
          throw error;
        }
      }

      // Add Lambda as target
      const putTargetsCommand = new PutTargetsCommand({
        Rule: ruleName,
        Targets: [
          {
            Id: "1",
            Arn: this.lambdaArn,
            Input: JSON.stringify({
              detail: {
                source: "eventbridge",
                jobType,
                payload,
              },
            }),
          },
        ],
      });

      await this.eventBridgeClient.send(putTargetsCommand);

      logger.info(`Scheduled job in EventBridge`, {
        ruleName,
        jobType,
        scheduleExpression,
        ruleArn,
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
      await this.eventBridgeClient.send(removeTargetsCommand);

      // Remove Lambda permission
      try {
        const removePermissionCommand = new RemovePermissionCommand({
          FunctionName: this.lambdaFunctionName,
          StatementId: `${jobId}`,
        });
        await this.lambdaClient.send(removePermissionCommand);
      } catch (error: any) {
        // Ignore if permission doesn't exist
        if (error.name !== "ResourceNotFoundException") {
          logger.warn("Failed to remove Lambda permission", {
            jobId,
            error: error.message,
          });
        }
      }

      // Delete the rule
      const deleteRuleCommand = new DeleteRuleCommand({
        Name: jobId,
      });
      await this.eventBridgeClient.send(deleteRuleCommand);

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
    // EventBridge requires ? for day-of-month when day-of-week is *
    const parts = cronExpression.split(" ");
    if (parts.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
      // If both day fields are *, replace day-of-month with ?
      const ebDayOfMonth =
        dayOfMonth === "*" && dayOfWeek === "*" ? "?" : dayOfMonth;
      return `cron(${minute} ${hour} ${ebDayOfMonth} ${month} ${dayOfWeek} *)`;
    }
    // If already in EventBridge format, return as is
    return cronExpression;
  }
}
