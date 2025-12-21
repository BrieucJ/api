import { createRouter } from "@/utils/helpers";

import * as handlers from "./error.handlers";
import * as routes from "./error.routes";

const router = createRouter().openapi(routes.error, handlers.error);

export default router;
