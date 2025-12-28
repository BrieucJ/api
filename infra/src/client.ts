import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";

export function deploy(env: string) {
  // Read from process.env (REGION should be available from env files if client needs it)
  // For client, REGION is only used for S3 sync commands
  const REGION = process.env.REGION || "eu-west-3";
  const name = `client-${env}`;

  // Log environment variables being used
  console.log("📋 Environment variables for Client deployment:");
  console.log("  REGION:", REGION);

  // 1️⃣ Reference lambda stack to get API URL
  const lambdaStack = new pulumi.StackReference(`lambda-${env}`, {
    name: `lambda-${env}`,
  });
  const apiUrl = lambdaStack.requireOutput("apiUrl");

  // 2️⃣ S3 Bucket for static website hosting
  const bucket = new aws.s3.Bucket(`${name}-bucket`, {
    forceDestroy: true,
  });

  // Block public access (CloudFront will access via OAI)
  new aws.s3.BucketPublicAccessBlock(`${name}-publicAccessBlock`, {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });

  // 3️⃣ Build client with API URL
  const buildClient = new command.local.Command(
    `${name}-buildClient`,
    {
      create: pulumi.all([apiUrl]).apply(([url]) => {
        const apiUrlValue = url as string;
        return `cd ../../apps/client && export VITE_BACKEND_URL="${apiUrlValue}" && bun install --frozen-lockfile && bun run build`;
      }),
    },
    { dependsOn: [bucket] }
  );

  // 4️⃣ Upload files to S3
  const uploadFiles = new command.local.Command(
    `${name}-uploadFiles`,
    {
      create: pulumi.interpolate`
        cd ../../apps/client &&
        aws s3 sync dist/ s3://${bucket.id}/ \
          --region ${REGION} \
          --delete \
          --cache-control "public, max-age=31536000, immutable" \
          --exclude "*.html" &&
        aws s3 sync dist/ s3://${bucket.id}/ \
          --region ${REGION} \
          --delete \
          --cache-control "public, max-age=0, must-revalidate" \
          --include "*.html"
      `,
    },
    { dependsOn: [buildClient] }
  );

  // 5️⃣ CloudFront Origin Access Identity
  const oai = new aws.cloudfront.OriginAccessIdentity(`${name}-oai`, {
    comment: `OAI for ${name}`,
  });

  // 6️⃣ S3 Bucket Policy for CloudFront
  const bucketPolicy = new aws.s3.BucketPolicy(
    `${name}-bucketPolicy`,
    {
      bucket: bucket.id,
      policy: pulumi
        .all([oai.iamArn, bucket.arn])
        .apply(([oaiArn, bucketArn]) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  AWS: oaiArn,
                },
                Action: "s3:GetObject",
                Resource: `${bucketArn}/*`,
              },
            ],
          })
        ),
    },
    { dependsOn: [oai, bucket] }
  );

  // 7️⃣ CloudFront Distribution
  const distribution = new aws.cloudfront.Distribution(
    `${name}-distribution`,
    {
      enabled: true,
      isIpv6Enabled: true,
      defaultRootObject: "index.html",
      priceClass: "PriceClass_100", // Use only North America and Europe

      origins: [
        {
          originId: bucket.arn,
          domainName: bucket.bucketDomainName,
          s3OriginConfig: {
            originAccessIdentity: oai.cloudfrontAccessIdentityPath,
          },
        },
      ],

      defaultCacheBehavior: {
        targetOriginId: bucket.arn,
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD"],
        compress: true,
        forwardedValues: {
          queryString: false,
          cookies: {
            forward: "none",
          },
        },
        minTtl: 0,
        defaultTtl: 3600,
        maxTtl: 86400,
      },

      // Handle SPA routing - return index.html for 404s
      customErrorResponses: [
        {
          errorCode: 404,
          responseCode: 200,
          responsePagePath: "/index.html",
          errorCachingMinTtl: 300,
        },
        {
          errorCode: 403,
          responseCode: 200,
          responsePagePath: "/index.html",
          errorCachingMinTtl: 300,
        },
      ],

      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },

      viewerCertificate: {
        cloudfrontDefaultCertificate: true,
      },
    },
    { dependsOn: [bucketPolicy, oai, uploadFiles] }
  );

  return {
    bucketName: bucket.id,
    bucketArn: bucket.arn,
    distributionId: distribution.id,
    distributionArn: distribution.arn,
    distributionUrl: pulumi.interpolate`https://${distribution.domainName}`,
  };
}
