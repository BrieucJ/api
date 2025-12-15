import app from "../api/index";
import env from "../env";

const port = env.PORT;

Bun.serve({
  fetch: app.fetch,
  port,
});
