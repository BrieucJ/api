import type { AppRouteHandler } from "@/utils/types";
import type { GetRoute } from "./info.routes";
import * as HTTP_STATUS_CODES from "@/utils/http-status-codes";
import packageJSON from "../../../../../package.json";
import env from "@/env";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { SERVER_START_TIME } from "@/api/index";

export const get: AppRouteHandler<GetRoute> = async (c) => {
  // Check database connection
  let databaseConnected = false;
  try {
    await db.execute(sql`SELECT 1`);
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  const uptimeMs = Date.now() - SERVER_START_TIME;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeDays = Math.floor(uptimeHours / 24);

  const uptime = {
    milliseconds: uptimeMs,
    seconds: uptimeSeconds,
    minutes: uptimeMinutes,
    hours: uptimeHours,
    days: uptimeDays,
    formatted: `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${
      uptimeSeconds % 60
    }s`,
  };

  const info = {
    name: packageJSON.name,
    version: packageJSON.version,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime,
    apiBasePath: "/api/v1",
    database: {
      connected: databaseConnected,
    },
  };

  return c.json(
    {
      data: info,
      error: null,
      metadata: null,
    },
    HTTP_STATUS_CODES.OK
  );
};
