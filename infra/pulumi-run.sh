#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_NODE_PROJECT_ABS="$SCRIPT_DIR/tsconfig.json"

if [[ ! -f "$TS_NODE_PROJECT_ABS" ]]; then
  echo "❌ infra tsconfig.json not found at $TS_NODE_PROJECT_ABS"
  exit 1
fi

# always use absolute path
export TS_NODE_PROJECT="$TS_NODE_PROJECT_ABS"
export PULUMI_NODEJS_USE_TS_NODE=true
export PULUMI_CONFIG_PASSPHRASE=''

# change to infra dir so Pulumi.yaml is found
cd "$SCRIPT_DIR"

PLATFORM=${1:-}
ENV=${2:-}
ACTION=${3:-}

if [[ -z "$PLATFORM" || -z "$ENV" || -z "$ACTION" ]]; then
  echo "Usage: $0 <platform> <env> <up|destroy>"
  exit 1
fi

FULL_STACK_NAME="${PLATFORM}-${ENV}"

mkdir -p ~/.pulumi/stacks
bun x pulumi login file://~/.pulumi/stacks

if ! bun x pulumi stack select "$FULL_STACK_NAME" >/dev/null 2>&1; then
  bun x pulumi stack init "$FULL_STACK_NAME"
fi

# run Pulumi, Bun should propagate TS_NODE_PROJECT correctly
bun x pulumi "$ACTION" -s "$FULL_STACK_NAME" --yes
