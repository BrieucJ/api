import { createRouter } from "@/utils/helpers";
import * as handlers from "./refreshTokens.handlers";
import * as routes from "./refreshTokens.routes";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.get, handlers.get)
  .openapi(routes.remove, handlers.remove);

export default router;
