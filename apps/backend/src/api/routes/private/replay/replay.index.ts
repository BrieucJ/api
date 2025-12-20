import { createRouter } from "@/utils/helpers";
import { list, get, replay } from "./replay.handlers";
import { list as listRoute, get as getRoute, replay as replayRoute } from "./replay.routes";

const router = createRouter();

router.openapi(listRoute, list);
router.openapi(getRoute, get);
router.openapi(replayRoute, replay);

export default router;

