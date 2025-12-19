import { z } from "zod";
import { logSelectSchema } from "@backend/db/models/logs";
import { infoResponseSchema } from "@backend/api/routes/private/info/info.routes";
import { healthResponseSchema } from "@backend/api/routes/private/health/health.routes";
export type { AppType } from "@backend/api/index";
export type LogSelectType = z.infer<typeof logSelectSchema>;
export type ApiInfo = z.infer<typeof infoResponseSchema>;
export type HealthStatus = z.infer<typeof healthResponseSchema>;
