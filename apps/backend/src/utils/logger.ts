import env from "../env";
import { db } from "@/db/client";
import { logs, logInsertSchema } from "@/db/models/logs";
import { generateRowEmbedding } from "@/utils/encode";

const COLORS = {
  debug: "\x1b[35m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
  API: "\x1b[32m",
  DB: "\x1b[34m",
};

type BunLoggerLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

const levelPriority: Record<BunLoggerLevel, number> = {
  silent: 0,
  fatal: 1,
  error: 2,
  warn: 3,
  info: 4,
  debug: 5,
  trace: 6,
};

const envLevel = (env && env.LOG_LEVEL) || "info";
const envPriority = levelPriority[envLevel] ?? 4;

function shouldLog(level: BunLoggerLevel) {
  return levelPriority[level] <= envPriority && envLevel !== "silent";
}

export class Logger {
  namespace: string;
  skipDbLogging: boolean;

  constructor(namespace: string, skipDbLogging = false) {
    this.namespace = namespace;
    this.skipDbLogging = skipDbLogging;
  }

  private format(level: keyof typeof COLORS, args: [string, ...unknown[]]) {
    const formatArg = (arg: unknown) => {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch {
          return "[Circular]";
        }
      }
      return String(arg);
    };

    const time = new Date().toISOString();
    const message = formatArg(args[0]);
    const extra = args.slice(1).map(formatArg).join(" ");

    const LEVEL_WIDTH = 5;
    const NAMESPACE_WIDTH = 8;
    const PREFIX_WIDTH =
      time.length + 1 + LEVEL_WIDTH + 1 + NAMESPACE_WIDTH + 1;

    const levelStr = `${level.toUpperCase()}`.padEnd(LEVEL_WIDTH);
    const namespaceStr = `[${this.namespace}]`.padEnd(NAMESPACE_WIDTH);
    const nsColor = COLORS[this.namespace as keyof typeof COLORS] ?? "\x1b[36m";
    const colored = `${COLORS[level]}${levelStr}${COLORS.reset} ${nsColor}${namespaceStr}${COLORS.reset}`;

    const fullMessage = `${message}${extra ? " " + extra : ""}`;
    const lines = fullMessage.split("\n");
    const paddedLines = lines.map((line, idx) =>
      idx === 0 ? line : line.padStart(line.length + PREFIX_WIDTH)
    );

    return `${time} ${colored} ${paddedLines.join("\n")}`;
  }

  private async write(level: BunLoggerLevel, args: [string, ...unknown[]]) {
    if (!args.length) return;

    const [message, ...rest] = args;

    // The rest of the arguments are optional metadata
    let meta: Record<string, any> = {};
    for (const [i, arg] of rest.entries()) {
      if (arg && typeof arg === "object") {
        meta = { ...meta, ...(arg as Record<string, any>) };
      } else {
        meta[`arg${i + 1}`] = arg;
      }
    }

    // Console logging
    if (shouldLog(level)) {
      const method = ["fatal", "error"].includes(level) ? "error" : level;
      (console as any)[method](this.format(level as keyof typeof COLORS, args));
    }

    if (this.skipDbLogging) return;

    try {
      const data = logInsertSchema.parse({
        source: this.namespace,
        level,
        message,
        meta,
      });
      await db
        .insert(logs)
        .values({ ...data, embedding: generateRowEmbedding(data) });
    } catch (e) {
      console.error(`[Logger][DB] Failed to insert log:`, e);
      throw e;
    }
  }

  debug(message: string, ...args: unknown[]) {
    return this.write("debug", [message, ...args] as [string, ...unknown[]]);
  }
  info(message: string, ...args: unknown[]) {
    return this.write("info", [message, ...args] as [string, ...unknown[]]);
  }
  warn(message: string, ...args: unknown[]) {
    return this.write("warn", [message, ...args] as [string, ...unknown[]]);
  }
  error(message: string, ...args: unknown[]) {
    return this.write("error", [message, ...args] as [string, ...unknown[]]);
  }
  fatal(message: string, ...args: unknown[]) {
    return this.write("fatal", [message, ...args] as [string, ...unknown[]]);
  }
  trace(message: string, ...args: unknown[]) {
    return this.write("trace", [message, ...args] as [string, ...unknown[]]);
  }

  withNamespace(ns: string) {
    return new Logger(ns, this.skipDbLogging);
  }

  middleware() {
    return async (c: any, next: any) => {
      const start = Date.now();
      let body: any = null;
      try {
        body = await c.req.json();
      } catch {}
      try {
        await next();
      } catch (err) {
        await this.error(
          err instanceof Error ? err.stack || err.message : String(err),
          {
            method: c.req.method,
            path: c.req.path,
            headers: c.req.header(),
            body,
          }
        );
        throw err;
      } finally {
        const durationMs = Date.now() - start;
        await this.info(`${c.req.method} ${c.req.url}`, {
          method: c.req.method,
          path: c.req.path,
          headers: c.req.header(),
          body,
          geo: c.geo || null,
          durationMs,
          status: c.res.status || 200,
        });
      }
    };
  }
}

// API logger
export const logger = new Logger("API");

// DB logger (skip DB insert to avoid infinite recursion)
export const dbLogger = new Logger("DB", true);
