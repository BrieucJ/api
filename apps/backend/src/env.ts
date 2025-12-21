/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

// Get the directory where this file is located, then go up to the app directory
const appDir = path.resolve(import.meta.dir, "..");
const envFileName = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
const envPath = path.resolve(appDir, envFileName);

expand(
  config({
    path: envPath,
    quiet: true,
  })
);

const EnvSchema = z.object({
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
  WORKER_URL: z.url().optional(),
  SQS_QUEUE_URL: z.url().optional(),
  AWS_REGION: z.string().optional(),
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
