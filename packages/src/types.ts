import { z } from "zod";
import { logSelectSchema } from "@backend/db/models/logs";
export type { AppType } from "@backend/api/index";
export type LogSelectType = z.infer<typeof logSelectSchema>;
