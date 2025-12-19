import type { AppOpenAPI } from "./types";
import { streamSSE } from "hono/streaming";
import { db } from "@/db/client";
import { logs } from "@/db/models/logs";
import { gt, desc } from "drizzle-orm";

import { createQueryBuilder } from "@/db/querybuilder";

const logQuery = createQueryBuilder<typeof logs>(logs);

export default function configureMonitoring(app: AppOpenAPI) {
  app.get("/logs/stream", async (c) => {
    const INITIAL_LOG_COUNT = 50; // Number of last logs to send on connect
    return streamSSE(c, async (stream) => {
      // 1️⃣ Send last X logs immediately
      const initialLogs = await db
        .select()
        .from(logs)
        .orderBy(desc(logs.id))
        .limit(INITIAL_LOG_COUNT);

      // We want them in chronological order
      for (const log of initialLogs.reverse()) {
        await stream.writeSSE({
          data: JSON.stringify(log),
          event: "log-update",
        });
      }

      // Keep track of the last log ID
      let lastId = (initialLogs[initialLogs.length - 1] ?? {}).id ?? 0;

      // 2️⃣ Stream new logs as they come
      while (true) {
        const newLogs = await db.select().from(logs).where(gt(logs.id, lastId));

        for (const log of newLogs) {
          await stream.writeSSE({
            data: JSON.stringify(log),
            event: "log-update",
          });
          lastId = Math.max(lastId, log.id);
        }

        // Sleep 1 second before checking again
        await stream.sleep(1000);
      }
    });
  });
}
