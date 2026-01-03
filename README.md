# API Monitoring & Observability Platform

A comprehensive multi-platform API monitoring and observability system with real-time metrics, logs, request replay capabilities, and a modern dashboard. Built with Bun, Hono, React, and PostgreSQL.

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd api
bun install

# Set up environment variables
cp apps/backend/.env.example apps/backend/.env.dev
cp apps/worker/.env.example apps/worker/.env.dev
cp apps/client/.env.example apps/client/.env

# Set up database
createdb api_db
psql api_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
cd apps/backend
bun run db:migrate

# Start all services
cd ../..
bun run dev
```

See [Getting Started](./docs/getting-started.md) for detailed setup instructions.

## Overview

This platform provides comprehensive observability for APIs with:

- **Real-time Metrics**: Automatic collection and aggregation of API performance metrics (latency, error rates, traffic)
- **Real-time Updates**: Polling-based updates for logs and metrics
- **Request Replay**: Capture and replay HTTP requests for debugging and testing
- **Vector Search**: Semantic search capabilities using PostgreSQL vector embeddings
- **Background Jobs**: Asynchronous job processing with SQS/local queue support
- **Modern Dashboard**: React-based UI with real-time updates and interactive charts

### Use Cases

- API performance monitoring and alerting
- Debugging production issues through request replay
- Real-time log analysis and filtering
- Metrics aggregation and visualization
- Geographic request tracking
- Historical data analysis

## Documentation

- **[Getting Started](./docs/getting-started.md)** - Installation, setup, and running locally
- **[Architecture](./docs/architecture.md)** - System design, tech stack, and component descriptions
- **[Development](./docs/development.md)** - Development commands, code structure, and workflows
- **[API Documentation](./docs/api-documentation.md)** - API endpoints, authentication, and response formats
- **[Database](./docs/database.md)** - Schema, migrations, and vector search
- **[Worker & Jobs](./docs/worker-jobs.md)** - Background job processing and queue system
- **[Frontend](./docs/frontend.md)** - Dashboard features and components
- **[Deployment](./docs/deployment.md)** - Infrastructure as Code, Terraform, and CI/CD
- **[Configuration](./docs/configuration.md)** - Environment variables and settings
- **[Contributing](./docs/contributing.md)** - Code style, development workflow, and guidelines

## Project Structure

```
api/
├── apps/
│   ├── backend/     # Backend API (Hono + Bun)
│   ├── client/       # Frontend (React + Vite)
│   └── worker/      # Background worker
├── infra/           # Infrastructure as Code (Terraform)
├── packages/        # Shared packages
└── docs/           # Documentation
```

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono, Drizzle ORM, PostgreSQL
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts
- **Infrastructure**: Terraform, AWS (Lambda, SQS, EventBridge, API Gateway, CloudFront)

## Features

- ✅ Real-time metrics collection and aggregation
- ✅ Real-time updates via polling (2-second intervals)
- ✅ Request snapshot and replay capabilities
- ✅ Vector-based semantic search
- ✅ Background job processing with retry logic
- ✅ CRON-based scheduled jobs
- ✅ Geo-location tracking
- ✅ Interactive OpenAPI documentation
- ✅ Comprehensive health checks
- ✅ Security headers and request size limits

## License

[Add your license here]

## Support

[Add support information here]
