import { Scalar } from "@scalar/hono-api-reference";
import type { AppOpenAPI } from "./types";
import packageJSON from "../../package.json";
import env from "@/env";

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: packageJSON.name,
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description:
          env.NODE_ENV === "development" ? "Local Development" : "Production",
      },
    ],
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
}
