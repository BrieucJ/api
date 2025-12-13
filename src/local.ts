import { logger } from "./utils/logger";
import app from "./api/index";
import env from "./env";

const port = env.PORT;

logger.info(`🚀 Server is running on http://localhost:${port}`);

Bun.serve({
  fetch: app.fetch,
  port,
});
