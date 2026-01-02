import { logs, logInsertSchema } from "@/db/models/logs";
import { createQueryBuilder } from "@/db/querybuilder";

const logQuery = createQueryBuilder<typeof logs>(logs);

export class LogPersistence {
  async save(entry: {
    source: string;
    level: string;
    message: string;
    meta?: Record<string, any>;
  }) {
    try {
      const data = logInsertSchema.parse(entry);
      await logQuery.create(data);
    } catch (error) {
      // Log to console if DB persistence fails
      console.error("[LogPersistence] Failed to save log:", error);
    }
  }
}

export const logPersistence = new LogPersistence();
