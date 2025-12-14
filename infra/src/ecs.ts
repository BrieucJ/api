import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";

export function deploy(env: string) {
  const name = `api-${env}`;
  const { DATABASE_URL, LOG_LEVEL, NODE_ENV, PORT } = process.env;

  // -------------------------
  // 1️⃣ ECR repository
  const repo = new aws.ecr.Repository(name, { forceDelete: true });

  // Build & push Docker image
  const buildImage = new command.local.Command(`${name}-buildImage`, {
    create: pulumi.interpolate`
      cd ../../ &&
      aws ecr get-login-password --region eu-west-3 \
        | docker login --username AWS --password-stdin ${repo.repositoryUrl} &&
      docker build -t ${name} -f .docker/Dockerfile.ecs . &&
      docker tag ${name} ${repo.repositoryUrl}:${env} &&
      docker push ${repo.repositoryUrl}:${env}
    `,
  });

  // -------------------------
  // 2️⃣ Networking
  const vpc = pulumi.output(aws.ec2.getVpc({ default: true }));
  const subnets = vpc.apply((v) =>
    aws.ec2.getSubnets({ filters: [{ name: "vpc-id", values: [v.id] }] })
  );

  const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
    vpcId: vpc.apply((v) => v.id),
    description: `Allow HTTP`,
    ingress: [
      { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    ],
    egress: [
      { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
  });

  // -------------------------
  // 3️⃣ ECS cluster
  const cluster = new aws.ecs.Cluster(`${name}-cluster`);

  // -------------------------
  // 4️⃣ Task definition
  const taskDef = new aws.ecs.TaskDefinition(
    `${name}-task`,
    {
      family: name,
      cpu: "256",
      memory: "512",
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: new aws.iam.Role(`${name}-execRole`, {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "ecs-tasks.amazonaws.com",
        }),
      }).arn,
      containerDefinitions: pulumi
        .all([repo.repositoryUrl])
        .apply(([repoUrl]) =>
          JSON.stringify([
            {
              name: name,
              image: `${repoUrl}:${env}`,
              essential: true,
              environment: [
                { name: "DATABASE_URL", value: DATABASE_URL! },
                { name: "LOG_LEVEL", value: LOG_LEVEL! },
                { name: "NODE_ENV", value: NODE_ENV! },
                { name: "PORT", value: PORT! },
              ],
              portMappings: [{ containerPort: 80, protocol: "tcp" }],
            },
          ])
        ),
    },
    { dependsOn: [buildImage] }
  );

  // -------------------------
  // 5️⃣ Fargate service
  const service = new aws.ecs.Service(`${name}-service`, {
    cluster: cluster.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    taskDefinition: taskDef.arn,
    networkConfiguration: {
      assignPublicIp: true,
      subnets: subnets.apply((s) => s.ids),
      securityGroups: [sg.id],
    },
  });

  return {
    clusterName: cluster.name,
    serviceName: service.name,
    serviceArn: service.arn,
    containerImage: pulumi.interpolate`${repo.repositoryUrl}:${env}`,
  };
}
