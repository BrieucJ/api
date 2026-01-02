import { createRouter } from "@/utils/helpers";
import * as handlers from "./worker.handlers";
import * as routes from "./worker.routes";

const router = createRouter().openapi(routes.getStats, handlers.getStats);

export default router;
