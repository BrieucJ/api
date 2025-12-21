import { createRouter } from "@/utils/helpers";
import * as handlers from "./worker.handlers";
import * as routes from "./worker.routes";

const router = createRouter()
  .openapi(routes.getJobs, handlers.getJobs)
  .openapi(routes.getQueueStats, handlers.getQueueStats)
  .openapi(routes.getScheduledJobs, handlers.getScheduledJobs)
  .openapi(routes.getStats, handlers.getStats);

export default router;

