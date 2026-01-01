# GitHub Actions Setup Guide

This guide helps you configure GitHub Actions for automated deployment.

## Prerequisites

1. AWS account with appropriate IAM permissions
2. Terraform S3 backend configured (see [DEPLOYMENT.md](../infra/DEPLOYMENT.md))
3. GitHub repository with Actions enabled

## Step 1: Configure GitHub Secrets

Go to your repository settings:

```
Settings → Secrets and variables → Actions → New repository secret
```

### Required Secrets

Add the following secrets:

| Secret Name | Description | Example Value |
|------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

### Optional Secrets

| Secret Name | Description | Default Value |
|------------|-------------|---------------|
| `LOG_LEVEL` | Logging level | `info` |
| `PORT` | Backend/API port | `8080` |

## Step 2: Set Up Environments (Optional but Recommended)

For better control, create environments:

1. Go to **Settings → Environments**
2. Create two environments:
   - `staging`
   - `production`
3. Add environment-specific secrets if needed
4. Configure protection rules:
   - For `production`: Enable "Required reviewers" for safety
   - For `staging`: Optional, can auto-deploy

## Step 3: Verify AWS Permissions

Your AWS IAM user/role needs these permissions:

- **ECR**: Full access (push/pull images)
- **ECS**: Full access (manage services)
- **Lambda**: Full access (deploy functions)
- **S3**: Full access (upload client files, Terraform state)
- **CloudFront**: Full access (manage distributions)
- **API Gateway**: Full access (manage HTTP APIs)
- **IAM**: CreateRole, AttachRolePolicy, PassRole
- **SQS**: Full access (manage queues)
- **EventBridge**: Full access (manage schedules)
- **DynamoDB**: Full access (Terraform state locking)

Example IAM policy (adjust as needed):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:*",
        "ecs:*",
        "lambda:*",
        "s3:*",
        "cloudfront:*",
        "apigateway:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole",
        "iam:GetRole",
        "iam:DeleteRole",
        "iam:DetachRolePolicy",
        "sqs:*",
        "events:*",
        "dynamodb:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Step 4: Deploy via GitHub Actions

### Automatic Deployment

Push to your branch:

```bash
# Deploy to staging
git push origin staging

# Deploy to production
git push origin main
```

### Manual Deployment

1. Go to **Actions** tab in GitHub
2. Select "Deploy Infrastructure" workflow
3. Click "Run workflow"
4. Choose environment (staging or production)
5. Click "Run workflow" button

## Step 5: Monitor Deployment

1. Go to **Actions** tab
2. Click on the running workflow
3. Monitor each step's progress
4. Check the deployment summary at the bottom

## Deployment Outputs

After successful deployment, check the summary for:

- API Gateway URL
- CloudFront distribution URL
- ECR repository URIs
- Other resource identifiers

## Troubleshooting

### "AWS credentials not configured"

- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets are set
- Check the secrets don't have leading/trailing whitespace

### "Docker build failed"

- Check Dockerfile syntax
- Verify dependencies are installable
- Check build logs for specific errors

### "Terraform apply failed"

- Check Terraform state bucket exists
- Verify AWS permissions are sufficient
- Check for resource conflicts (existing resources with same names)
- Review Terraform error messages in logs

### "Environment file not found"

- Ensure `DATABASE_URL` secret is configured
- Check workflow creates environment files correctly

### State Lock Errors

If you get DynamoDB state lock errors:

1. Wait for other Terraform operations to complete
2. Check DynamoDB table `terraform-state-lock` for stuck locks
3. Manually remove lock if needed (use caution!)

## Security Best Practices

1. **Use Environment Protection Rules**: Require approval for production deployments
2. **Rotate Credentials Regularly**: Update AWS access keys periodically
3. **Use Least Privilege**: Grant only necessary AWS permissions
4. **Enable Branch Protection**: Require PR reviews before merging to main
5. **Monitor Actions Logs**: Review deployment logs regularly
6. **Use Environment Secrets**: Separate secrets per environment when possible

## Next Steps

After setting up GitHub Actions:

1. Test with a staging deployment first
2. Verify all resources are created correctly
3. Test the deployed API and client
4. Set up monitoring and alerting
5. Configure automatic rollback on failure (optional)

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Terraform Cloud Backends](https://www.terraform.io/docs/language/settings/backends/s3.html)

