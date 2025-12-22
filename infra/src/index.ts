import * as pulumi from "@pulumi/pulumi";
import { deploy as lambdaDeploy } from "./lambda";
import { deploy as ecsDeploy } from "./ecs";
import { deploy as workerDeploy } from "./worker";
import { deploy as clientDeploy } from "./client";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../apps/backend/.env"),
  quiet: true,
});

dotenv.config({
  path: path.resolve(__dirname, "../../apps/worker/.env"),
  quiet: true,
});

dotenv.config({
  path: path.resolve(__dirname, "../../apps/client/.env"),
  quiet: true,
});

const stack = pulumi.getStack(); // e.g., lambda-prod
const [platform, env] = stack.split("-");

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
