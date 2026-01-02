import { createRouter } from "@/utils/helpers";
import * as handlers from "./health.handlers";
import * as routes from "./health.routes";

const router = createRouter()
  .openapi(routes.get, handlers.get)
  .openapi(routes.getLiveness, handlers.getLiveness)
  .openapi(routes.getReadiness, handlers.getReadiness)
  .openapi(routes.getDatabaseHealth, handlers.getDatabaseHealth)
  .openapi(routes.getWorkerHealth, handlers.getWorkerHealth);

export default router;
