import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";

export function deploy(env: string) {
  // Read from process.env (loaded from env file by index.ts) - these are our config values
  const DATABASE_URL = process.env.DATABASE_URL;
  const LOG_LEVEL = process.env.LOG_LEVEL || "info";
  const NODE_ENV = process.env.NODE_ENV;
  const PORT = process.env.PORT;
  const REGION = process.env.REGION;

  if (!REGION) {
    throw new Error("REGION environment variable is required but not set");
  }

  // Log all environment variables being used
  console.log("📋 Environment variables for Lambda deployment:");
  console.log("  DATABASE_URL:", DATABASE_URL);
  console.log("  LOG_LEVEL:", LOG_LEVEL);
  console.log("  NODE_ENV:", NODE_ENV);
  console.log("  PORT:", PORT);
  console.log("  REGION:", REGION);

  const name = `api-${env}`;

  // Capture REGION in a const for use in closures
  const regionValue = REGION;

  // 1️⃣ Reference worker stack to get SQS queue URL
  const workerStack = new pulumi.StackReference(`worker-${env}`, {
    name: `worker-${env}`,
  });
  const workerQueueUrl = workerStack.requireOutput("queueUrl");
  const workerQueueArn = workerStack.requireOutput("queueArn");

  // 2️⃣ ECR
  const repo = new aws.ecr.Repository(name, { forceDelete: true });

  // 3️⃣ Lambda IAM role
  const lambdaRole = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "lambda.amazonaws.com",
    }),
  });
  new aws.iam.RolePolicyAttachment(`${name}-lambdaBasicExecution`, {
    role: lambdaRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  // Add SQS permissions for backend to enqueue jobs
  new aws.iam.RolePolicy(`${name}-sqsPolicy`, {
    role: lambdaRole.name,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "sqs:SendMessage",
            "sqs:GetQueueAttributes"
          ],
          "Resource": "${workerQueueArn}"
        }
      ]
    }`,
  });

  // 4️⃣ Docker build & push
  const buildLambdaImage = new command.local.Command(
    `${name}-buildLambdaImage`,
    {
      create: pulumi.interpolate`
      # Move to repo root so Docker build context includes everything
      cd ../../ &&
      # Login to AWS ECR
      aws ecr get-login-password --region ${regionValue} \
        | docker login --username AWS --password-stdin ${repo.repositoryUrl} &&
      # Build Lambda image
      docker build -t ${name} -f .docker/Dockerfile.lambda . &&
      # Tag and push
      docker tag ${name} ${repo.repositoryUrl}:${env} &&
      docker push ${repo.repositoryUrl}:${env}
    `,
    }
  );

  // 5️⃣ API Gateway (created before Lambda so we can use its endpoint in Lambda env vars)
  const apiGateway = new aws.apigatewayv2.Api(`${name}-apiGateway`, {
    protocolType: "HTTP",
  });

  // 6️⃣ Lambda function
  const apiLambda = new aws.lambda.Function(
    `${name}-apiLambda`,
    {
      packageType: "Image",
      imageUri: pulumi.interpolate`${repo.repositoryUrl}:${env}`,
      role: lambdaRole.arn,
      timeout: 10,
      memorySize: 512,
      environment: {
        variables: {
          DATABASE_URL: DATABASE_URL || "",
          LOG_LEVEL: LOG_LEVEL || "info",
          PORT: PORT || "3000",
          NODE_ENV: NODE_ENV || "production",
          REGION: regionValue,
          SQS_QUEUE_URL: workerQueueUrl.apply((url) => url as string),
          API_URL: apiGateway.apiEndpoint.apply((url) => url as string),
        },
      },
    },
    { dependsOn: [buildLambdaImage] }
  );
  // 7️⃣ API Gateway Integration
  const lambdaIntegration = new aws.apigatewayv2.Integration(
    `${name}-lambdaIntegration`,
    {
      apiId: apiGateway.id,
      integrationType: "AWS_PROXY",
      integrationUri: apiLambda.arn,
      integrationMethod: "POST",
      payloadFormatVersion: "2.0",
    }
  );
  const apiRoute = new aws.apigatewayv2.Route(`${name}-apiRoute`, {
    apiId: apiGateway.id,
    routeKey: "ANY /{proxy+}",
    target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
  });

  const apiStage = new aws.apigatewayv2.Stage(`${name}-apiStage`, {
    apiId: apiGateway.id,
    name: "$default",
    autoDeploy: true,
  });

  new aws.lambda.Permission(`${name}-apiInvokePermission`, {
    action: "lambda:InvokeFunction",
    function: apiLambda.name,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${apiGateway.executionArn}/*/*`,
  });

  return {
    apiLambdaArn: apiLambda.arn,
    apiLambdaName: apiLambda.name,
    apiUrl: apiGateway.apiEndpoint,
    ecrRepoUrl: repo.repositoryUrl,
  };
}
