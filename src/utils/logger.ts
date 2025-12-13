import env from "../env";

const COLORS = {
  debug: "\x1b[35m", // magenta
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
  API: "\x1b[32m", // green
  DB: "\x1b[34m", // blue
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

const format = (
  level: keyof typeof COLORS,
  namespace: string,
  ...args: unknown[]
) => {
  const formatArg = (arg: unknown) =>
    arg instanceof Error ? arg.stack || arg.message : arg;
  const time = new Date().toISOString();
  const color = COLORS[level] || COLORS.info;
  const formattedArgs = args.map(formatArg);
  return [
    `${time} ${color}${level.toUpperCase()}${COLORS.reset} ${
      COLORS[namespace as keyof typeof COLORS]
    }[${namespace}]${COLORS.reset}`,
    ...formattedArgs,
  ];
};

function shouldLog(level: BunLoggerLevel) {
  return levelPriority[level] <= envPriority && envLevel !== "silent";
}

// Logger factory
function createLogger(namespace: string) {
  return {
    debug: (...args: unknown[]) =>
      shouldLog("debug") &&
      console.debug(...format("debug", namespace, ...args)),
    info: (...args: unknown[]) =>
      shouldLog("info") && console.info(...format("info", namespace, ...args)),
    warn: (...args: unknown[]) =>
      shouldLog("warn") && console.warn(...format("warn", namespace, ...args)),
    error: (...args: unknown[]) =>
      shouldLog("error") &&
      console.error(...format("error", namespace, ...args)),
    withNamespace: (newNamespace: string) => createLogger(newNamespace),
    middleware: () => (c: any, next: any) => next(),
  };
}

// Default API logger
export const logger = createLogger("API");

// DB logger for Drizzle
export const dbLogger = logger.withNamespace("DB");
