import { logger } from "@/utils/logger";
import { EventBridgeScheduler } from "@/utils/eventbridge";
import { getAllCronJobs } from "@/jobs";
import env from "@/env";

// ============================================================================
// Cron Job Initialization
// ============================================================================

let cronJobsInitialized = false;
let cronJobsInitializing = false;

export async function ensureCronJobsScheduled(): Promise<void> {
  if (cronJobsInitialized) return;
  if (cronJobsInitializing) {
    while (!cronJobsInitialized) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  cronJobsInitializing = true;
  try {
    if (!env.LAMBDA_ARN) {
      throw new Error("LAMBDA_ARN is required to schedule cron jobs");
    }
    const scheduler = new EventBridgeScheduler(env.LAMBDA_ARN);
    const defaultCronJobs = getAllCronJobs();
    logger.info("Scheduling default CRON jobs in Lambda", {
      count: defaultCronJobs.length,
    });

    await Promise.all(
      defaultCronJobs.map(async (jobDef) => {
        if (jobDef.enabled) {
          try {
            await scheduler.schedule(
              jobDef.cronExpression,
              jobDef.jobType,
              jobDef.payload
            );
          } catch (error) {
            logger.error("Failed to schedule cron job", {
              jobType: jobDef.jobType,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      })
    );

    cronJobsInitialized = true;
    logger.info("All cron jobs scheduled successfully");
  } catch (error) {
    logger.error("Failed to schedule cron jobs", {
      error: error instanceof Error ? error.message : String(error),
    });
    cronJobsInitializing = false;
    throw error;
  }
}
