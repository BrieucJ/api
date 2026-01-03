import { createRouter } from "@/utils/helpers";
import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = createRouter()
  .openapi(routes.login, handlers.login)
  .openapi(routes.refresh, handlers.refresh)
  .openapi(routes.me, handlers.me)
  .openapi(routes.logout, handlers.logout);

export default router;
