/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

// Safely get app directory, handling both ESM (Bun/runtime) and CJS (drizzle-kit) contexts
let appDir: string;
try {
  // Try ESM import.meta (available in Bun and Node ESM)
  if (typeof import.meta !== "undefined" && import.meta.dir) {
    appDir = path.resolve(import.meta.dir, "..");
  } else {
    appDir = process.cwd();
  }
} catch {
  // Fallback to process.cwd() if import.meta is not available (CJS context)
  appDir = process.cwd();
}

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const isProductionOrStaging =
  process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";

if (!isLambda && !isProductionOrStaging) {
  let envPath: string;
  if (process.env.NODE_ENV === "test") {
    envPath = path.resolve(appDir, ".env.test");
  } else {
    // Default to .env.dev for development
    const envDevPath = path.resolve(appDir, ".env.dev");
    const envPathLegacy = path.resolve(appDir, ".env");
    envPath = envDevPath;
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
}

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
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .optional(),
  JWT_EXPIRES_IN: z.string().default("24h"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(7),
  REGION: z.string().optional(),
  SQS_QUEUE_URL: z.url().optional(),
  WORKER_URL: z.url().optional(),
  API_URL: z.url().optional(),
});

// Conditional validation based on NODE_ENV
const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  const isProduction = data.NODE_ENV === "production";
  const isStaging = data.NODE_ENV === "staging";

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
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

// Provide default JWT_SECRET for test environments
const envWithDefaults = {
  ...env!,
  JWT_SECRET:
    env!.JWT_SECRET ||
    (env!.NODE_ENV === "test"
      ? "test-jwt-secret-key-for-testing-only-min-32-chars"
      : env!.JWT_SECRET),
};

export default envWithDefaults as env & { JWT_SECRET: string };
