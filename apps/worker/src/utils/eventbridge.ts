import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import { LambdaClient, AddPermissionCommand } from "@aws-sdk/client-lambda";
import { logger } from "@/utils/logger";
import env from "@/env";
import type { JobType } from "@/jobs/types";

export class EventBridgeScheduler {
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

      return ruleName;
    } catch (error) {
      logger.error("Failed to schedule job in EventBridge", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
