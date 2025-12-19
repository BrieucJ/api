import { hc } from "hono/client";
import type { AppType } from "@shared/types";
import config from "./config";

export const client = hc<AppType>(`${config.BACKEND_URL}/api/v1`, {
  init: { credentials: "include" },
});
