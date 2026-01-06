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
  LOG_LEVEL: z.enum([
    "fatal",
    "error",
    "warn",
    "info",
    "debug",
    "trace",
    "silent",
  ]),
  PORT: z.coerce.number().default(8081),
  DATABASE_URL: z.url(),
  // Optional fields that may be required based on NODE_ENV and LAMBDA_ARN
  REGION: z.string().optional(),
  SQS_QUEUE_URL: z.url().optional(),
  LAMBDA_ARN: z.string().optional(), // Required for Lambda mode to schedule EventBridge cron jobs
});

// Conditional validation based on NODE_ENV and LAMBDA_ARN
const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  const isProduction = data.NODE_ENV === "production";
  const isStaging = data.NODE_ENV === "staging";
  const isLambdaMode = !!data.LAMBDA_ARN;

  // In production/staging or when LAMBDA_ARN is set, AWS resources are required
  if (isProduction || isStaging || isLambdaMode) {
    if (!data.SQS_QUEUE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SQS_QUEUE_URL is required in production/staging environments or when LAMBDA_ARN is set",
        path: ["SQS_QUEUE_URL"],
      });
    }
    if (!data.REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "REGION is required in production/staging environments or when LAMBDA_ARN is set",
        path: ["REGION"],
      });
    }
    if (!data.LAMBDA_ARN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "LAMBDA_ARN is required in production/staging environments",
        path: ["LAMBDA_ARN"],
      });
    }
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
