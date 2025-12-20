import * as pulumi from "@pulumi/pulumi";
import { deploy as lambdaDeploy } from "./lambda";
import { deploy as ecsDeploy } from "./ecs";
import { deploy as workerDeploy } from "./worker";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../apps/backend/.env") });

const stack = pulumi.getStack(); // e.g. lambda-prod
const [platform, env] = stack.split("-");

if (!platform || !env) {
  throw new Error("Stack name must be <platform>-<env>");
}

pulumi.log.info(`Platform: ${platform}`);
pulumi.log.info(`Environment: ${env}`);

let outputs: Record<string, any> = {};

if (platform === "lambda") {
  outputs = lambdaDeploy(env) || {};
  outputs.apiLambdaArn.apply((arn: string) => {
    console.log("arn", arn);
  });
  outputs.apiLambdaName.apply((name: string) => {
    console.log("name:", name);
  });
  outputs.apiUrl.apply((url: string) => {
    console.log("url:", url);
  });
}

if (platform === "ecs") {
  outputs = ecsDeploy(env);
}

if (platform === "worker") {
  outputs = workerDeploy(env) || {};
  outputs.workerLambdaArn.apply((arn: string) => {
    console.log("worker lambda arn:", arn);
  });
  outputs.queueUrl.apply((url: string) => {
    console.log("queue url:", url);
  });
}
