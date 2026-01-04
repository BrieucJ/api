import { createRouter } from "@/utils/helpers";
import * as handlers from "./admin.handlers";
import * as routes from "./admin.routes";

const router = createRouter()
  .openapi(routes.listModels, handlers.listModels)
  .openapi(routes.getSchema, handlers.getSchema);

export default router;
