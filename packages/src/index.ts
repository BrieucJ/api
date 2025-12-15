import { hc } from "hono/client";
import type { AppType } from "@backend/api";

export const client = (baseUrl: string) =>
  hc<AppType>(baseUrl, {
    init: { credentials: "include" },
  });
