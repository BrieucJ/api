import env from "@/env";
import users from "@/api/routes/users/users.index";
import { createApp } from "@/utils/helpers";
import { logger } from "@/utils/logger";
import configureOpenAPI from "@/utils/openApi";

logger.info(`🚀 Server is running on http://localhost:${env.PORT}`);

const app = createApp();

configureOpenAPI(app);

const routes = [users] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export default app;
export type AppType = (typeof routes)[number];
