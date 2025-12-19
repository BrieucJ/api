import { createRouter } from "@/utils/helpers";
import * as handlers from "./info.handlers";
import * as routes from "./info.routes";

const router = createRouter().openapi(routes.get, handlers.get);

export default router;
