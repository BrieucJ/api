import * as pulumi from "@pulumi/pulumi";
import { deploy as lambdaDeploy } from "./lambda";
import { deploy as ecsDeploy } from "./ecs";
import { deploy as workerDeploy } from "./worker";
import { deploy as clientDeploy } from "./client";
import * as dotenv from "dotenv";
import path from "node:path";

const stack = pulumi.getStack(); // e.g., lambda-prod
const [platform, env] = stack.split("-");

// Map environment to env file name
// prod -> env.production, staging -> env.staging, default -> env.dev
let envFileName: string;
if (env === "prod") {
  envFileName = ".env.production";
} else if (env === "staging") {
  envFileName = ".env.staging";
} else {
  envFileName = ".env.dev";
}

// Load the appropriate environment file based on platform
// Backend (lambda/ecs) uses apps/backend/env.*
// Worker uses apps/worker/env.*
// These env files are loaded into process.env, which serves as our config source
if (platform === "lambda" || platform === "ecs") {
  const backendEnvPath = path.resolve(
    __dirname,
    "../../apps/backend",
    envFileName
  );
  dotenv.config({
    path: backendEnvPath,
    quiet: true,
  });
  pulumi.log.info(`Loading backend environment from: ${backendEnvPath}`);
  pulumi.log.info(
    `DATABASE_URL loaded - length: ${process.env.DATABASE_URL?.length}`
  );
  pulumi.log.info(
    `DATABASE_URL ends with /postgres: ${process.env.DATABASE_URL?.endsWith(
      "/postgres"
    )}`
  );
} else if (platform === "worker") {
  const workerEnvPath = path.resolve(
    __dirname,
    "../../apps/worker",
    envFileName
  );
  dotenv.config({
    path: workerEnvPath,
    quiet: true,
  });
  pulumi.log.info(`Loading worker environment from: ${workerEnvPath}`);
  // Debug: Check what was actually loaded
  pulumi.log.info(
    `DATABASE_URL loaded - length: ${process.env.DATABASE_URL?.length}`
  );
  pulumi.log.info(
    `DATABASE_URL ends with /postgres: ${process.env.DATABASE_URL?.endsWith(
      "/postgres"
    )}`
  );
}

if (!platform || !env) {
  throw new Error("Stack name must be <platform>-<env>");
}

pulumi.log.info(`Platform: ${platform}`);
pulumi.log.info(`Environment: ${env}`);

let outputs: Record<string, pulumi.Output<any>> = {};

// Deploy based on platform
switch (platform) {
  case "lambda":
    outputs = lambdaDeploy(env) || {};
    break;
  case "ecs":
    outputs = ecsDeploy(env) || {};
    break;
  case "worker":
    outputs = workerDeploy(env) || {};
    break;
  case "client":
    outputs = clientDeploy(env) || {};
    break;
  default:
    throw new Error(`Unknown platform: ${platform}`);
}

// Export all outputs at top-level
// Only outputs that exist for the current stack will be available
export const apiLambdaArn = outputs.apiLambdaArn;
export const apiLambdaName = outputs.apiLambdaName;
export const apiUrl = outputs.apiUrl;
export const ecrRepoUrl = outputs.ecrRepoUrl;
export const workerLambdaArn = outputs.workerLambdaArn;
export const workerLambdaName = outputs.workerLambdaName;
export const queueUrl = outputs.queueUrl;
export const queueArn = outputs.queueArn;
export const dlqUrl = outputs.dlqUrl;
export const dlqArn = outputs.dlqArn;
export const bucketName = outputs.bucketName;
export const distributionId = outputs.distributionId;
export const distributionUrl = outputs.distributionUrl;
