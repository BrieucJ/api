import { createRouter } from "@/utils/helpers";
import { list, aggregate } from "./metrics.handlers";
import {
  list as listRoute,
  aggregate as aggregateRoute,
} from "./metrics.routes";

const router = createRouter();

router.openapi(listRoute, list);
router.openapi(aggregateRoute, aggregate);

export default router;
