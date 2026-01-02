import env from "@/env";
import { createApp } from "@/utils/helpers";
import { logger } from "@/utils/logger";
import configureOpenAPI from "@/utils/openApi";
import { auth } from "@/api/middlewares";
//PUBLIC ROUTES
import users from "@/api/routes/public/users/users.index";
// PRIVATE ROUTES
import authRoutes from "@/api/routes/private/auth/auth.index";
import logs from "@/api/routes/private/logs/logs.index";
import info from "@/api/routes/private/info/info.index";
import health from "@/api/routes/private/health/health.index";
import metrics from "@/api/routes/private/metrics/metrics.index";
import replay from "@/api/routes/private/replay/replay.index";
import error from "@/api/routes/private/error/error.index";
import worker from "@/api/routes/private/worker/worker.index";
import { Scalar } from "@scalar/hono-api-reference";
import packageJSON from "../../package.json";

// Store server start time for uptime calculation
export const SERVER_START_TIME = Date.now();

logger.info(`🚀 Server is running on http://localhost:${env.PORT}`);

const app = createApp();

configureOpenAPI(app);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: packageJSON.version,
    title: packageJSON.name,
  },
});
app.get(
  "/reference",
  Scalar({
    url: "/doc",
    theme: "kepler",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
  })
);

const publicRoutes = [users] as const;

const privateRoutes = [
  authRoutes,
  logs,
  info,
  health,
  metrics,
  replay,
  error,
  worker,
] as const;

const allRoutes = [...publicRoutes, ...privateRoutes] as const;

// Apply auth middleware to private routes only (skip /auth/login)
app.use("/*", async (c, next) => {
  // Skip auth for public routes (mounted at /api/v1)
  if (c.req.path.startsWith("/api/v1")) {
    await next();
    return;
  }
  // Skip auth for /auth/login (public endpoint)
  if (c.req.path === "/auth/login") {
    await next();
    return;
  }
  // Apply auth middleware for all other private routes
  return auth(c, next);
});

// Register all routes
allRoutes.forEach((route) => {
  const path = publicRoutes.includes(route) ? "/api/v1" : "/";
  app.route(path, route);
});

export default app;
export type AppType = (typeof allRoutes)[number];
