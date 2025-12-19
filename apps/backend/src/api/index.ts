import env from "@/env";
import { createApp } from "@/utils/helpers";
import { logger } from "@/utils/logger";
import configureOpenAPI from "@/utils/openApi";
//PUBLIC ROUTES
import users from "@/api/routes/public/users/users.index";
// PRIVATE ROUTES
import logs from "@/api/routes/private/logs/logs.index";

logger.info(`🚀 Server is running on http://localhost:${env.PORT}`);

const app = createApp();

configureOpenAPI(app);

const publicRoutes = [users] as const;

const privateRoutes = [logs] as const;

const allRoutes = [...publicRoutes, ...privateRoutes] as const;

allRoutes.forEach((route) => {
  const path = publicRoutes.includes(route) ? "/api/v1" : "/";
  app.route(path, route);
});

export default app;
export type AppType = (typeof allRoutes)[number];
