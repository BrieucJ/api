import env from "@/env";
import { LocalQueue } from "./local";
import { SQSQueue } from "./sqs";
import type { Queue } from "./types";

let queueInstance: Queue | null = null;

export function getQueue(): Queue {
  if (queueInstance) {
    return queueInstance;
  }

  if (env.WORKER_MODE === "lambda" || env.SQS_QUEUE_URL) {
    queueInstance = new SQSQueue();
  } else {
    queueInstance = new LocalQueue();
  }

  return queueInstance;
}

export { LocalQueue, SQSQueue };
export type { Queue } from "./types";
