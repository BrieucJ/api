# Deployment Guide

This guide walks you through deploying the infrastructure using Terraform.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Terraform** installed (version 1.0+)
4. **Docker** installed and running
5. **Environment files** configured

## Step 1: Create S3 Bucket for Terraform State

Create an S3 bucket to store Terraform state files:

```bash
# Replace with your bucket name
aws s3 mb s3://your-terraform-state-bucket --region eu-west-3

# Enable versioning (recommended)
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled
```

## Step 2: Create DynamoDB Table (Optional but Recommended)

Create a DynamoDB table for state locking to prevent concurrent modifications:

```bash
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-3
```

## Step 3: Configure Environment Variables

Set the Terraform state configuration:

```bash
export TERRAFORM_STATE_BUCKET="your-terraform-state-bucket"
export TERRAFORM_STATE_REGION="eu-west-3"  # Optional, defaults to AWS_REGION
export TERRAFORM_STATE_DYNAMODB_TABLE="terraform-state-lock"  # Optional
export AWS_REGION="eu-west-3"
```

## Step 4: Configure Environment Files

Ensure your environment files are set up:

**`apps/backend/env.production`** (or `env.staging`):
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
LOG_LEVEL=info
NODE_ENV=production
PORT=3000
REGION=eu-west-3
```

**`apps/worker/env.production`** (or `env.staging`):
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
LOG_LEVEL=info
NODE_ENV=production
PORT=8081
REGION=eu-west-3
WORKER_MODE=lambda
```

## Step 5: Deploy Infrastructure

Deploy in this order (each depends on the previous):

### 5.1 Deploy Worker (First)

```bash
cd infra
bash terraform-run.sh worker prod init    # Initialize Terraform
bash terraform-run.sh worker prod plan    # Review changes
bash terraform-run.sh worker prod apply   # Deploy
```

This creates:
- ECR repository for worker images
- SQS queue (main + dead letter queue)
- Lambda function for worker
- IAM roles and permissions

**Note**: The first deployment will build and push Docker images, which may take several minutes.

### 5.2 Deploy Lambda (Second)

```bash
bash terraform-run.sh lambda prod init
bash terraform-run.sh lambda prod plan
bash terraform-run.sh lambda prod apply
```

This creates:
- ECR repository for API images
- Lambda function for API
- API Gateway (HTTP API)
- IAM roles and permissions
- References worker stack for SQS queue URL

### 5.3 Deploy Client (Third)

```bash
bash terraform-run.sh client prod init
bash terraform-run.sh client prod plan
bash terraform-run.sh client prod apply
```

This creates:
- S3 bucket for static files
- CloudFront distribution
- Origin Access Control (OAC)
- Bucket policy
- References lambda stack for API URL

## Step 6: Deploy All at Once (Alternative)

You can also use the npm script to deploy everything:

```bash
# From project root
bun run infra:deploy:all:prod
```

This runs:
1. `bash infra/infra-run.sh deploy worker prod`
2. `bash infra/infra-run.sh deploy lambda prod`
3. `bash infra/infra-run.sh deploy client prod`

## Step 7: Verify Deployment

After deployment, check the outputs:

```bash
# Get worker outputs
cd infra/worker
terraform output

# Get lambda outputs (API URL)
cd ../lambda
terraform output

# Get client outputs (CloudFront URL)
cd ../client
terraform output
```

## Troubleshooting

### Terraform State Issues

If you get state locking errors:
- Wait for other Terraform runs to complete
- Check DynamoDB table for stuck locks
- Manually delete lock entry if needed (be careful!)

### Docker Build Issues

If Docker builds fail:
- Ensure Docker is running
- Check AWS ECR login permissions
- Verify Dockerfile paths are correct

### Remote State Issues

If remote state data sources fail:
- Ensure previous stacks are deployed first
- Check state file paths in S3
- Verify backend configuration matches

### Environment Variable Issues

If variables are missing:
- Check environment files exist in `apps/backend/` and `apps/worker/`
- Verify file names match: `env.production` or `env.staging`
- Ensure all required variables are set

## Updating Infrastructure

To update existing infrastructure:

```bash
# Make changes to Terraform files
# Then apply changes
bash terraform-run.sh <platform> <env> plan   # Review
bash terraform-run.sh <platform> <env> apply  # Apply
```

## Destroying Infrastructure

To destroy infrastructure (be careful!):

```bash
# Destroy in reverse order
bash terraform-run.sh client prod destroy
bash terraform-run.sh lambda prod destroy
bash terraform-run.sh worker prod destroy
```

Or use the npm script:

```bash
bun run infra:destroy:all:prod
```

## CI/CD Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Builds Docker images
2. Pushes to ECR
3. Deploys using Terraform

Ensure these GitHub secrets are configured:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DATABASE_URL`
- `LOG_LEVEL`
- `PORT`
- `TERRAFORM_STATE_BUCKET` (optional, can be set in workflow)
- `TERRAFORM_STATE_DYNAMODB_TABLE` (optional)

## Next Steps

After deployment:

1. **Test the API**: Use the API Gateway URL from lambda outputs
2. **Test the Client**: Use the CloudFront URL from client outputs
3. **Monitor Logs**: Check CloudWatch logs for Lambda functions
4. **Set up Alarms**: Configure CloudWatch alarms for monitoring

