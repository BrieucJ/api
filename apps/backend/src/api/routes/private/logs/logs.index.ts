import { createRouter } from "@/utils/helpers";
import * as handlers from "./logs.handlers";
import * as routes from "./logs.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.stream, handlers.stream);

export default router;
