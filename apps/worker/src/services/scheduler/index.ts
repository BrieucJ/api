import env from "@/env";
import { LocalScheduler } from "./local";
import { EventBridgeScheduler } from "./eventbridge";
import type { Scheduler } from "./types";

let schedulerInstance: Scheduler | null = null;

export function getScheduler(lambdaArn?: string): Scheduler {
  if (schedulerInstance) {
    return schedulerInstance;
  }

  if (env.WORKER_MODE === "lambda" && lambdaArn) {
    schedulerInstance = new EventBridgeScheduler(lambdaArn);
  } else {
    schedulerInstance = new LocalScheduler();
  }

  return schedulerInstance;
}

export { LocalScheduler, EventBridgeScheduler };
export type { Scheduler, CronJob } from "./types";

