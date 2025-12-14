#!/usr/bin/env bash
set -euo pipefail

# ------------------------------
# Pulumi deploy helper script
# Usage: ./pulumi-run.sh <platform> <env> <up|destroy>
# Example: ./pulumi-run.sh lambda staging up
# ------------------------------

# Change to the directory of this script so Pulumi.yaml is found
cd "$(dirname "$0")"

# --- Arguments ---
PLATFORM=${1:-}
ENV=${2:-}
ACTION=${3:-}

if [[ -z "$PLATFORM" || -z "$ENV" || -z "$ACTION" ]]; then
  echo "Usage: $0 <platform> <env> <up|destroy>"
  exit 1
fi

# --- Pulumi stack name (file backend) ---
FULL_STACK_NAME="${PLATFORM}-${ENV}"

echo "========================================"
echo "Platform: $PLATFORM"
echo "Environment: $ENV"
echo "Action: $ACTION"
echo "Stack: $FULL_STACK_NAME"
echo "Directory: $(pwd)"
echo "========================================"

# --- Setup Pulumi environment ---
mkdir -p ~/.pulumi/stacks
export PULUMI_CONFIG_PASSPHRASE=''
export PULUMI_NODEJS_USE_TS_NODE=true
export TS_NODE_PROJECT="$(pwd)/tsconfig.json" 

# --- Login to local Pulumi backend ---
bun x pulumi login file://~/.pulumi/stacks

# --- Select or initialize stack ---
if ! bun x pulumi stack select "$FULL_STACK_NAME" >/dev/null 2>&1; then
  echo "Stack does not exist. Initializing: $FULL_STACK_NAME"
  bun x pulumi stack init "$FULL_STACK_NAME"
else
  echo "Stack selected: $FULL_STACK_NAME"
fi

# --- Run the Pulumi action ---
bun x pulumi "$ACTION" -s "$FULL_STACK_NAME" --yes

echo "✅ Pulumi action '$ACTION' completed for stack '$FULL_STACK_NAME'"
