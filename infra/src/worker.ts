import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";

export function deploy(env: string) {
  const { DATABASE_URL, LOG_LEVEL, NODE_ENV } = process.env;
  const name = `worker-${env}`;
  const accountId = aws.getCallerIdentity().then((id) => id.accountId);
  // 1️⃣ ECR Repository
  const repo = new aws.ecr.Repository(name, { forceDelete: true });

  // 2️⃣ SQS Queue with DLQ
  const dlq = new aws.sqs.Queue(`${name}-dlq`, {
    messageRetentionSeconds: 1209600, // 14 days
  });

  const queue = new aws.sqs.Queue(`${name}-queue`, {
    messageRetentionSeconds: 345600, // 4 days
    visibilityTimeoutSeconds: 900, // 5 minutes
    receiveWaitTimeSeconds: 20, // Long polling
    redrivePolicy: pulumi.interpolate`{
      "deadLetterTargetArn": "${dlq.arn}",
      "maxReceiveCount": 3
    }`,
  });

  // 3️⃣ Lambda IAM Role
  const lambdaRole = new aws.iam.Role(`${name}-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "lambda.amazonaws.com",
    }),
  });

  // Basic execution role
  new aws.iam.RolePolicyAttachment(`${name}-lambdaBasicExecution`, {
    role: lambdaRole.name,
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  });

  // SQS permissions
  new aws.iam.RolePolicy(`${name}-sqsPolicy`, {
    role: lambdaRole.name,
    policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes",
            "sqs:SendMessage"
          ],
          "Resource": "${queue.arn}"
        },
        {
          "Effect": "Allow",
          "Action": [
            "sqs:GetQueueAttributes"
          ],
          "Resource": "${dlq.arn}"
        }
      ]
    }`,
  });

  // EventBridge permissions
  new aws.iam.RolePolicy(`${name}-eventbridgePolicy`, {
    role: lambdaRole.name,
    policy: `{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "events:PutRule",
            "events:PutTargets",
            "events:DeleteRule",
            "events:RemoveTargets",
            "events:ListRules"
          ],
          "Resource": "*"
        }
      ]
    }`,
  });

  // 4️⃣ Docker build & push
  const buildWorkerImage = new command.local.Command(
    `${name}-buildWorkerImage`,
    {
      create: pulumi.interpolate`
      # Move to repo root so Docker build context includes everything
      cd ../../ &&
      # Login to AWS ECR
      aws ecr get-login-password --region eu-west-3 \
        | docker login --username AWS --password-stdin ${repo.repositoryUrl} &&
      # Build Worker image
      docker build -t ${name} -f .docker/Dockerfile.worker . &&
      # Tag and push
      docker tag ${name} ${repo.repositoryUrl}:${env} &&
      docker push ${repo.repositoryUrl}:${env}
    `,
    }
  );

  // 5️⃣ Lambda function
  const workerLambda = new aws.lambda.Function(
    `${name}-lambda`,
    {
      packageType: "Image",
      imageUri: pulumi.interpolate`${repo.repositoryUrl}:${env}`,
      role: lambdaRole.arn,
      timeout: 900, // 15 minutes
      memorySize: 512,
      environment: {
        variables: {
          DATABASE_URL: DATABASE_URL!,
          LOG_LEVEL: LOG_LEVEL!,
          NODE_ENV: NODE_ENV!,
          WORKER_MODE: "lambda",
          SQS_QUEUE_URL: queue.url,
        },
      },
    },
    { dependsOn: [buildWorkerImage] }
  );

  // 6️⃣ SQS Event Source Mapping
  const sqsMapping = new aws.lambda.EventSourceMapping(`${name}-sqsMapping`, {
    eventSourceArn: queue.arn,
    functionName: workerLambda.arn,
    batchSize: 1, // Process one message at a time
    maximumBatchingWindowInSeconds: 5,
  });

  // 7️⃣ EventBridge permission for Lambda
  new aws.lambda.Permission(`${name}-eventbridgePermission`, {
    action: "lambda:InvokeFunction",
    function: workerLambda.name,
    principal: "events.amazonaws.com",
    sourceArn: pulumi.interpolate`arn:aws:events:eu-west-3:${accountId}:rule/${name}-*`,
  });

  return {
    workerLambdaArn: workerLambda.arn,
    workerLambdaName: workerLambda.name,
    queueUrl: queue.url,
    queueArn: queue.arn,
    dlqUrl: dlq.url,
    dlqArn: dlq.arn,
    ecrRepoUrl: repo.repositoryUrl,
  };
}
