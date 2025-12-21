import * as pulumi from "@pulumi/pulumi";
import { deploy as lambdaDeploy } from "./lambda";
import { deploy as ecsDeploy } from "./ecs";
import { deploy as workerDeploy } from "./worker";
import { deploy as clientDeploy } from "./client";

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
export const apiLambdaArn = outputs.apiLambdaArn;
export const apiLambdaName = outputs.apiLambdaName;
export const apiUrl = outputs.apiUrl;
