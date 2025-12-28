/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Get the directory where this file is located, then go up to the app directory
// Use import.meta.dir if available (Bun), otherwise use import.meta.url (Node.js)
const currentDir =
  typeof import.meta.dir !== "undefined"
    ? import.meta.dir
    : path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(currentDir, "..");

// For local development, use env.dev, fallback to .env for backwards compatibility
let envPath: string;
if (process.env.NODE_ENV === "test") {
  envPath = path.resolve(appDir, ".env.test");
} else {
  // Try env.dev first, then fallback to .env
  const envDevPath = path.resolve(appDir, ".env.dev");
  const envPathLegacy = path.resolve(appDir, ".env");
  envPath = envDevPath; // Prefer env.dev
  // Also try loading .env as fallback
  expand(
    config({
      path: envPathLegacy,
      quiet: true,
    })
  );
}

expand(
  config({
    path: envPath,
    quiet: true,
  })
);

// Base schema with common fields
const BaseEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
  DATABASE_URL: z.url(),
  // Optional fields that may be required based on NODE_ENV
  REGION: z.string().optional(),
  SQS_QUEUE_URL: z.url().optional(),
  WORKER_URL: z.url().optional(),
  API_URL: z.url().optional(),
});

// Conditional validation based on NODE_ENV
const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  const isProduction = data.NODE_ENV === "production";
  const isStaging = data.NODE_ENV === "staging";
  const isDevelopment =
    data.NODE_ENV === "development" || (!isProduction && !isStaging);

  // In production/staging, SQS_QUEUE_URL is required
  if (isProduction || isStaging) {
    if (!data.SQS_QUEUE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SQS_QUEUE_URL is required in production/staging environments",
        path: ["SQS_QUEUE_URL"],
      });
    }
    if (!data.REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REGION is required in production/staging environments",
        path: ["REGION"],
      });
    }
  }

  // In development, WORKER_URL is required (unless SQS_QUEUE_URL is provided)
  if (isDevelopment && !data.WORKER_URL && !data.SQS_QUEUE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "WORKER_URL is required in development environment when SQS_QUEUE_URL is not set",
      path: ["WORKER_URL"],
    });
  }
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
