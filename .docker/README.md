# Docker Files for Monorepo Setup

This directory contains Dockerfiles for building container images for the monorepo applications.

## Files

- **Dockerfile.lambda** - Backend API for AWS Lambda deployment
- **Dockerfile.worker** - Background worker for AWS Lambda deployment
- **Dockerfile.ecs** - Backend API for AWS ECS/Fargate deployment
- **docker-compose.yml** - Local development PostgreSQL setup
- **test-docker.sh** - Test script to verify all Dockerfiles build correctly

## Monorepo Structure Support

All Dockerfiles are configured to work with the Bun workspace monorepo structure:

```
api/
├── package.json          # Root workspace config
├── bun.lock              # Lock file
├── apps/
│   ├── backend/         # Backend API
│   ├── worker/          # Background worker
│   └── client/          # Frontend (not containerized)
└── packages/            # Shared packages
    └── src/            # Shared code (re-exports from backend)
```

## Key Features

### Dependency Management
- All Dockerfiles copy workspace `package.json` files first for optimal layer caching
- Use `bun install --frozen-lockfile` for reproducible builds
- Include all necessary workspace dependencies

### Shared Packages
- The `packages/` directory contains shared code that re-exports from `apps/backend/`
- Worker Dockerfile includes both backend source and packages (packages depend on backend)
- Lambda Dockerfile includes packages (backend doesn't directly use @shared, but included for consistency)

### Path Aliases
- `@/*` resolves to `src/*` within each app
- `@shared/*` resolves to `../../packages/src/*`
- `@backend/*` (used in packages) resolves to `../apps/backend/src/*`
- All path aliases are properly configured in tsconfig.json files

### Build Process
- Multi-stage builds for smaller final images
- Lambda images use AWS Lambda Node.js base image
- ECS image uses Bun runtime directly
- All builds use bundling with minification and sourcemaps

## Building Images

### Backend Lambda
```bash
docker build -t api-lambda -f .docker/Dockerfile.lambda .
```

### Worker Lambda
```bash
docker build -t api-worker -f .docker/Dockerfile.worker .
```

### Backend ECS
```bash
docker build -t api-ecs -f .docker/Dockerfile.ecs .
```

## Testing

Run the test script to verify all Dockerfiles build correctly:

```bash
.docker/test-docker.sh
```

This script:
1. Tests that all Dockerfiles build successfully
2. Verifies that output files exist in the correct locations
3. Checks that bundled files have content

## Issues Fixed

### Dockerfile.lambda
- ✅ Fixed `--outfile` to `--outdir` when using `--sourcemap`
- ✅ Fixed output path from `lambda.js` to `dist/src/servers/lambda.js`
- ✅ Removed redundant `COPY packages` command

### Dockerfile.worker
- ✅ Added backend tsconfig.json for path resolution
- ✅ Added packages tsconfig.json for @backend/* path resolution
- ✅ Fixed output path from `lambda.js` to `dist/src/servers/lambda.js`

### Dockerfile.ecs
- ✅ **Complete rewrite** to support monorepo structure
- ✅ Added workspace package.json files
- ✅ Added packages directory
- ✅ Fixed source paths from `src/` to `apps/backend/src/`
- ✅ Fixed drizzle.config.ts path
- ✅ Fixed build command paths
- ✅ Fixed output path in CMD

## Build Context

All Dockerfiles expect to be run from the repository root:

```bash
# From repo root
docker build -f .docker/Dockerfile.lambda .
```

The build context includes:
- Root `package.json` and `bun.lock`
- All workspace `package.json` files
- All source code in `apps/` and `packages/`
- TypeScript configuration files

## Deployment

These Dockerfiles are used by Pulumi infrastructure code in `infra/src/`:
- `lambda.ts` uses `Dockerfile.lambda`
- `worker.ts` uses `Dockerfile.worker`
- `ecs.ts` uses `Dockerfile.ecs`

The Pulumi scripts handle:
- Building the Docker images
- Pushing to AWS ECR
- Deploying to Lambda or ECS

