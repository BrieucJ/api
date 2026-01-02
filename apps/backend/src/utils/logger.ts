import env from "../env";
import { logPersistence } from "./logPersistence";

const COLORS = {
  debug: "\x1b[35m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m",
  API: "\x1b[32m",
  DB: "\x1b[34m",
  WORKER: "\x1b[35m",
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

  constructor(namespace: string) {
    this.namespace = namespace;
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

    // const time = new Date().toISOString();
    const message = formatArg(args[0]);
    const extra = args.slice(1).map(formatArg).join(" ");

    const LEVEL_WIDTH = 5;
    const NAMESPACE_WIDTH = 8;
    const PREFIX_WIDTH = LEVEL_WIDTH + 1 + NAMESPACE_WIDTH + 1;

    const levelStr = `${level.toUpperCase()}`.padEnd(LEVEL_WIDTH);
    const namespaceStr = `[${this.namespace}]`.padEnd(NAMESPACE_WIDTH);
    const nsColor = COLORS[this.namespace as keyof typeof COLORS] ?? "\x1b[36m";
    const colored = `${nsColor}${namespaceStr}${COLORS.reset} ${COLORS[level]}${levelStr}${COLORS.reset} ${COLORS.reset}`;

    const fullMessage = `${message}${extra ? " " + extra : ""}`;
    const lines = fullMessage.split("\n");
    const paddedLines = lines.map((line, idx) =>
      idx === 0 ? line : line.padStart(line.length + PREFIX_WIDTH)
    );

    return `${colored} ${paddedLines.join("\n")}`;
  }

  private write(level: BunLoggerLevel, args: [string, ...unknown[]]) {
    if (!args.length) return;

    const [message, ...rest] = args;

    // Build metadata from rest arguments
    let meta: Record<string, any> = {};
    for (const arg of rest) {
      if (arg && typeof arg === "object") {
        meta = { ...meta, ...(arg as Record<string, any>) };
      }
    }

    // Console logging (synchronous)
    if (shouldLog(level)) {
      const method = ["fatal", "error"].includes(level) ? "error" : level;
      (console as any)[method](this.format(level as keyof typeof COLORS, args));
    }

    // Only save logs at or above info level to the database
    // This excludes debug and trace logs to reduce database noise
    if (levelPriority[level] > levelPriority.info) {
      return;
    }

    // Fire-and-forget database persistence (non-blocking)
    // Wrap in try-catch to ensure logger never throws
    try {
      logPersistence
        .save({
          source: this.namespace,
          level,
          message,
          meta: Object.keys(meta).length > 0 ? meta : undefined,
        })
        .catch((error) => {
          console.error("[LogPersistence] Failed to save log:", error);
        });
    } catch (error) {
      console.error("[Logger] Failed to save log:", error);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.write("debug", [message, ...args] as [string, ...unknown[]]);
  }
  info(message: string, ...args: unknown[]): void {
    this.write("info", [message, ...args] as [string, ...unknown[]]);
  }
  warn(message: string, ...args: unknown[]): void {
    this.write("warn", [message, ...args] as [string, ...unknown[]]);
  }
  error(message: string, ...args: unknown[]): void {
    this.write("error", [message, ...args] as [string, ...unknown[]]);
  }
  fatal(message: string, ...args: unknown[]): void {
    this.write("fatal", [message, ...args] as [string, ...unknown[]]);
  }
  trace(message: string, ...args: unknown[]): void {
    this.write("trace", [message, ...args] as [string, ...unknown[]]);
  }

  withNamespace(ns: string) {
    return new Logger(ns);
  }
}

// API logger
export const logger = new Logger("API");

// DB logger
export const dbLogger = new Logger("DB");

// Worker logger
export const workerLogger = new Logger("WORKER");
