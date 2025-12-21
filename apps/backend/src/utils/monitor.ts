import type { AppOpenAPI } from "./types";
import { streamSSE } from "hono/streaming";
import { createQueryBuilder } from "@/db/querybuilder";
import { logs } from "@/db/models/logs";

const logQuery = createQueryBuilder<typeof logs>(logs);

export default function configureMonitoring(app: AppOpenAPI) {
  app.get("/logs/stream", async (c) => {
    const INITIAL_LOG_COUNT = 50; // Number of last logs to send on connect
    return streamSSE(c, async (stream) => {
      // 1️⃣ Send last X logs immediately (newest first)
      const { data: initialLogs } = await logQuery.list({
        limit: INITIAL_LOG_COUNT,
        offset: 0,
        order_by: "id",
        order: "desc",
      });

      // Send them newest first (no reverse needed)
      for (const log of initialLogs) {
        await stream.writeSSE({
          data: JSON.stringify(log),
          event: "log-update",
        });
      }

      // Keep track of the last log ID (highest ID seen so far)
      let lastId = (initialLogs[0] ?? {}).id ?? 0;

      // 2️⃣ Stream new logs as they come
      while (true) {
        const { data: newLogs } = await logQuery.list({
          filters: { id__gt: lastId },
          limit: 1000, // Large limit to get all new logs
          order_by: "id",
          order: "asc",
        });

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
