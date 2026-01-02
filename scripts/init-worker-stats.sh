#!/bin/bash
# One-time script to initialize worker stats in production
# Run this after deployment to create the initial stats entry

set -e

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}

echo "🔄 Invoking worker Lambda to initialize stats..."

aws lambda invoke \
  --function-name "worker-${ENVIRONMENT}-lambda" \
  --region "${REGION}" \
  --payload '{"detail":{"source":"eventbridge.heartbeat","jobType":"heartbeat","payload":{}}}' \
  /dev/stdout

echo ""
echo "✅ Worker stats initialized!"
echo "🔍 Check your API: GET /worker/stats"

