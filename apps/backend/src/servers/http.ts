import app from "../api/index";
import env from "../env";
import { logger } from "../utils/logger";

const port = env.PORT;

const server = Bun.serve({
  fetch: app.fetch,
  port,
  idleTimeout: 255,
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.stop();
  logger.info("Shutdown complete");
  process.exit(0);
};

// Handle termination signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
