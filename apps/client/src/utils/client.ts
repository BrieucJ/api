// import { client as apiClient } from "@shared/client";

// export const client = apiClient("http://localhost:8080/api/v1");
import { hc } from "hono/client";
import type { AppType } from "@shared/client";

export const client = hc<AppType>("http://localhost:8080/api/v1", {
  init: { credentials: "include" },
});
