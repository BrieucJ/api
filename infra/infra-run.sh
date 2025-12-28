#!/usr/bin/env bash
set -euo pipefail

# Helper script to run infrastructure commands
# Usage: infra-run.sh <action> <platform> <env>
#   action: deploy|destroy
#   platform: worker|lambda|ecs|client
#   env: prod|staging

ACTION=${1:-}
PLATFORM=${2:-}
ENV=${3:-}

if [[ -z "$ACTION" || -z "$PLATFORM" || -z "$ENV" ]]; then
  echo "Usage: $0 <deploy|destroy> <platform> <env>"
  echo "  platform: worker|lambda|ecs|client"
  echo "  env: prod|staging"
  exit 1
fi

# Map deploy/destroy to apply/destroy for terraform-run.sh
TERRAFORM_ACTION="apply"
if [[ "$ACTION" == "destroy" ]]; then
  TERRAFORM_ACTION="destroy"
elif [[ "$ACTION" != "deploy" ]]; then
  echo "❌ Invalid action: $ACTION (must be 'deploy' or 'destroy')"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/terraform-run.sh" "$PLATFORM" "$ENV" "$TERRAFORM_ACTION"

