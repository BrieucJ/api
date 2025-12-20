import { createRouter } from "@/utils/helpers";
import { list, stream, aggregate } from "./metrics.handlers";
import { list as listRoute, stream as streamRoute, aggregate as aggregateRoute } from "./metrics.routes";

const router = createRouter();

router.openapi(listRoute, list);
router.openapi(streamRoute, stream);
router.openapi(aggregateRoute, aggregate);

export default router;

