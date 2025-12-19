import { createRouter } from "@/utils/helpers";
import * as handlers from "./health.handlers";
import * as routes from "./health.routes";

const router = createRouter().openapi(routes.get, handlers.get);

export default router;
