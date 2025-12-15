import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import users from "./routes/users";
import { onError, notFound, serveEmojiFavicon, geo } from "./middlewares";
import packageJSON from "../../package.json";
import { defaultHook } from "@/utils/helpers";
import { requestId } from "hono/request-id";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { languageDetector } from "hono/language";
import { timing } from "hono/timing";
import { z } from "zod";
import { logger, activeStreams } from "../utils/logger";
import env from "../env";
import { streamText } from "hono/streaming";

export type Bindings = { SECRET_KEY: string };

logger.info(`🚀 Server is running on http://localhost:${env.PORT}`);

const app = new OpenAPIHono<{ Bindings: Bindings }>({
  defaultHook,
}).basePath("/api/v1");

app
  .use(requestId())
  .use(cors())
  .use(csrf())
  .use(serveEmojiFavicon("🚀"))
  .use(
    languageDetector({
      fallbackLanguage: "en",
    })
  )
  .use(timing())
  .use(geo)
  .use(async (c, next) => {
    try {
      logger.info(`${c.req.method} ${c.req.url}`, {
        geo: c.geo, // now visible in logs
      });
      logger.info(`${c.req.method} ${c.req.url}`);
      logger.debug(c);
      await next();
    } catch (err) {
      // Log the error with stack trace if available
      logger.error(err instanceof Error ? err.stack || err.message : err);
      throw err; // rethrow so Hono's onError still handles it
    }
  });

app.openapi(
  {
    tags: ["Error"],
    method: "get",
    path: "/error",
    responses: {
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
  },
  (c) => {
    throw new Error("New Error");
  }
);

app.openapi(
  {
    tags: ["Health"],
    method: "get",
    path: "/health",
    responses: {
      200: {
        description: "Check API health",
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
      },
    },
  },
  (c) => c.json({ ok: true })
);

app.get("/logs", (c) => {
  return streamText(c, async (s) => {
    // Add this stream to the active set
    activeStreams.add(s);

    // Remove on abort
    s.onAbort(() => {
      activeStreams.delete(s);
    });

    // Function to send logs as JSON line
    function sendLog(entry: Record<string, any>) {
      s.writeln(JSON.stringify(entry)).catch(() => {
        activeStreams.delete(s);
      });
    }

    // Keep stream alive indefinitely
    while (!s.aborted) {
      await s.sleep(1000);
    }
  });
});

app.route("/users", users);

app.notFound(notFound);
app.onError(onError);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: packageJSON.version,
    title: packageJSON.name,
  },
});

// Scalar UI at /scalar
app.get(
  "/scalar",
  Scalar({
    url: "/api/v1/doc",
    layout: "classic",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
  })
);

export default app;
