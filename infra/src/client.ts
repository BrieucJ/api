import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";

export function deploy(env: string) {
  const { AWS_REGION } = process.env;
  const region = AWS_REGION || "eu-west-3";
  const name = `client-${env}`;

  // 1️⃣ S3 Bucket for static website hosting
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

  // 2️⃣ Upload files to S3 (assumes dist/ folder exists from build step)
  const uploadFiles = new command.local.Command(
    `${name}-uploadFiles`,
    {
      create: pulumi.interpolate`
        cd ../../apps/client &&
        aws s3 sync dist/ s3://${bucket.id}/ \
          --region ${region} \
          --delete \
          --cache-control "public, max-age=31536000, immutable" \
          --exclude "*.html" &&
        aws s3 sync dist/ s3://${bucket.id}/ \
          --region ${region} \
          --delete \
          --cache-control "public, max-age=0, must-revalidate" \
          --include "*.html"
      `,
    },
    { dependsOn: [bucket] }
  );

  // 4️⃣ CloudFront Origin Access Identity
  const oai = new aws.cloudfront.OriginAccessIdentity(`${name}-oai`, {
    comment: `OAI for ${name}`,
  });

  // 5️⃣ S3 Bucket Policy for CloudFront
  const bucketPolicy = new aws.s3.BucketPolicy(
    `${name}-bucketPolicy`,
    {
      bucket: bucket.id,
      policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${oai.id}"
          },
          "Action": "s3:GetObject",
          "Resource": "${bucket.arn}/*"
        }
      ]
    }`,
    },
    { dependsOn: [oai, bucket] }
  );

  // 6️⃣ CloudFront Distribution
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
