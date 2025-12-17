import env from "../env";
import { db } from "@/db/client";
import { logs, logInsertSchema } from "@/db/models/logs";

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

  private format(level: keyof typeof COLORS, args: unknown[]) {
    const formatArg = (arg: unknown) =>
      arg instanceof Error ? arg.stack || arg.message : String(arg);

    const time = new Date().toISOString();
    const formattedArgs = args.map(formatArg).join(" ");
    const colored = `${COLORS[level]}${level.toUpperCase()}${COLORS.reset} ${
      COLORS[this.namespace as keyof typeof COLORS]
    }[${this.namespace}]${COLORS.reset}`;

    // Include timestamp in the first element
    const message = `${time} ${colored} ${formattedArgs}`;

    return [message, ...args.map(formatArg)];
  }

  private async write(level: BunLoggerLevel, args: unknown[]) {
    if (!args.length) return;

    let message: string;
    let meta: Record<string, any> = {};

    // Determine message and meta
    const firstArg = args[0];

    if (typeof firstArg === "string") {
      message = firstArg;
      for (const arg of args.slice(1)) {
        if (arg && typeof arg === "object") {
          meta = { ...meta, ...(arg as Record<string, any>) };
        } else {
          meta = { ...meta, [`arg${Object.keys(meta).length + 1}`]: arg };
        }
      }
    } else if (firstArg instanceof Error) {
      message = firstArg.message;
      meta = { stack: firstArg.stack };
      for (const arg of args.slice(1)) {
        if (arg && typeof arg === "object") {
          meta = { ...meta, ...(arg as Record<string, any>) };
        } else {
          meta = { ...meta, [`arg${Object.keys(meta).length + 1}`]: arg };
        }
      }
    } else if (typeof firstArg === "object" && firstArg !== null) {
      // If first arg is object, treat as meta and use generic message
      message = "context";
      meta = { ...firstArg };
      for (const arg of args.slice(1)) {
        if (arg && typeof arg === "object") {
          meta = { ...meta, ...(arg as Record<string, any>) };
        } else {
          meta = { ...meta, [`arg${Object.keys(meta).length + 1}`]: arg };
        }
      }
    } else {
      message = String(firstArg);
      for (const arg of args.slice(1)) {
        meta = { ...meta, [`arg${Object.keys(meta).length + 1}`]: arg };
      }
    }

    // Console logging (preserve original args for colors)
    if (shouldLog(level)) {
      const method = ["fatal", "error"].includes(level) ? "error" : level;
      (console as any)[method](
        ...this.format(level as keyof typeof COLORS, args)
      );
    }

    if (this.skipDbLogging) return;

    // DB insert (structured meta)
    try {
      await db.insert(logs).values(
        logInsertSchema.parse({
          source: this.namespace,
          level,
          message,
          meta,
        })
      );
    } catch (e) {
      console.error(`[Logger][DB] Failed to insert log:`, e);
    }
  }

  debug(...args: unknown[]) {
    return this.write("debug", args);
  }
  info(...args: unknown[]) {
    return this.write("info", args);
  }
  warn(...args: unknown[]) {
    return this.write("warn", args);
  }
  error(...args: unknown[]) {
    return this.write("error", args);
  }
  fatal(...args: unknown[]) {
    return this.write("fatal", args);
  }
  trace(...args: unknown[]) {
    return this.write("trace", args);
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
