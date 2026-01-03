# Deployment

## Infrastructure as Code (Terraform)

The infrastructure is defined in `infra/` using Terraform. Each platform (worker, lambda, client, ecs) has its own Terraform module with separate state files.

### State Management

Terraform state is stored in S3 with the following structure:

- **State Bucket**: Configured via `TERRAFORM_STATE_BUCKET` environment variable
- **State Keys**: `{platform}-{env}/terraform.tfstate` (e.g., `worker-prod/terraform.tfstate`)
- **Locking**: Optional DynamoDB table for state locking (set via `TERRAFORM_STATE_DYNAMODB_TABLE`)

### Stack Naming

Stacks follow the pattern: `<platform>-<env>`

- `worker-prod`, `worker-staging`: Worker deployment
- `lambda-prod`, `lambda-staging`: Lambda deployment
- `client-prod`, `client-staging`: Client deployment
- `ecs-prod`, `ecs-staging`: ECS deployment

### Prerequisites

Before deploying, ensure you have:

1. **S3 Bucket** for Terraform state (create manually or via script)
2. **DynamoDB Table** (optional, for state locking)
3. **AWS Credentials** configured
4. **Environment files** in `apps/backend/` and `apps/worker/`

### Deploy Worker

```bash
# Set environment variables
export TERRAFORM_STATE_BUCKET="your-terraform-state-bucket"
export TERRAFORM_STATE_DYNAMODB_TABLE="terraform-state-lock"  # Optional

# Deploy
cd infra
bash terraform-run.sh worker prod apply
```

This creates:

- ECR repository
- SQS queue (main + dead letter queue)
- Lambda function for worker
- IAM roles and permissions
- EventBridge permissions

### Deploy Backend (Lambda)

```bash
# Deploy (worker must be deployed first for SQS queue)
bash terraform-run.sh lambda prod apply
```

This creates:

- ECR repository
- Lambda function (container image)
- API Gateway (HTTP API)
- IAM roles and permissions
- References worker stack for SQS queue URL

### Deploy Client

```bash
# Deploy (lambda must be deployed first for API URL)
bash terraform-run.sh client prod apply
```

This creates:

- S3 bucket
- CloudFront distribution with Origin Access Control (OAC)
- Bucket policy for CloudFront access
- References lambda stack for API URL

### Deploy All (Production)

```bash
# From project root
bun run infra:deploy:all:prod
```

This deploys worker, lambda, and client in order.

### Environment Configuration

Environment variables are loaded from:

- `apps/backend/env.production` or `apps/backend/env.staging`
- `apps/worker/env.production` or `apps/worker/env.staging`

Required variables:

```bash
DATABASE_URL=postgresql://...
LOG_LEVEL=info
REGION=eu-west-3
NODE_ENV=production
PORT=3000  # or 8081 for worker
```

### Terraform State Configuration

Set these environment variables before running Terraform:

```bash
export TERRAFORM_STATE_BUCKET="your-terraform-state-bucket"
export TERRAFORM_STATE_REGION="eu-west-3"  # Optional, defaults to AWS_REGION
export TERRAFORM_STATE_DYNAMODB_TABLE="terraform-state-lock"  # Optional
```

### Docker Images

The Lambda functions use container images. Terraform automatically builds and pushes images during deployment:

- Builds Docker images using `.docker/Dockerfile.lambda` and `.docker/Dockerfile.worker`
- Pushes to ECR repositories
- Updates Lambda functions with new images

### CI/CD Deployment

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Builds Docker images for worker and lambda
2. Pushes images to ECR
3. Deploys infrastructure using Terraform
4. Builds and deploys client to S3/CloudFront

The workflow uses Terraform to manage all infrastructure changes, ensuring consistency and version control.

