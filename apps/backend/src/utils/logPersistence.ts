import { logInsertSchema } from "@/db/models/logs";
// Lazy-load logQuery to avoid circular dependency
let _logQuery: any = null;
async function getLogQuery() {
  if (!_logQuery) {
    const queriesModule = await import("@/db/queries");
    _logQuery = queriesModule.logQuery;
  }
  return _logQuery;
}

export class LogPersistence {
  async save(entry: {
    source: string;
    level: string;
    message: string;
    meta?: Record<string, any>;
  }) {
    try {
      const data = logInsertSchema.parse(entry);
      // Lazy-load logQuery only when actually saving
      const logQuery = await getLogQuery();
      await logQuery.create(data);
    } catch (error) {
      // Log to console if DB persistence fails
      console.error("[LogPersistence] Failed to save log:", error);
    }
  }
}

export const logPersistence = new LogPersistence();
