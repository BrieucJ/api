# GitHub Configuration

This directory contains GitHub-specific configuration files for the project.

## Contents

### Workflows

- **`workflows/deploy.yml`**: Automated deployment workflow for staging and production environments

### Documentation

- **`GITHUB_ACTIONS_SETUP.md`**: Complete guide for setting up GitHub Actions CI/CD

## Quick Links

- [GitHub Actions Setup Guide](./GITHUB_ACTIONS_SETUP.md) - How to configure secrets and deploy
- [Deployment Documentation](../infra/DEPLOYMENT.md) - Infrastructure deployment guide

## Workflow Overview

The deployment workflow automatically:

1. ✅ Checks out code
2. ✅ Sets up Bun runtime
3. ✅ Configures AWS credentials and ECR login
4. ✅ Sets Terraform variables from GitHub Secrets
5. ✅ Initializes Terraform with S3 backend
6. ✅ Runs Terraform plan and apply
7. ✅ Builds and pushes Docker images to ECR
8. ✅ Deploys infrastructure using Terraform
9. ✅ Provides deployment outputs and summary

## Deployment Triggers

| Trigger | Environment | Description |
|---------|------------|-------------|
| Push to `production` | Production | Automatically deploys to production |
| Push to `staging` | Staging | Automatically deploys to staging |
| Manual workflow | Your choice | Deploy to any environment on demand |

## Getting Started

1. Read [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)
2. Configure required GitHub secrets
3. Push to `staging` branch to test
4. Merge to `production` for production deployment

## Support

For issues or questions:

1. Check the [troubleshooting section](./GITHUB_ACTIONS_SETUP.md#troubleshooting)
2. Review [deployment logs](../infra/DEPLOYMENT.md#troubleshooting)
3. Check AWS CloudWatch logs for runtime issues

