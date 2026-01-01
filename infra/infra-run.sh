#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Sequential Terraform deploy/destroy script
# -----------------------------
# Usage:
#   ./infra-run.sh deploy prod
#   ./infra-run.sh destroy staging
# -----------------------------

ACTION=${1:-}
ENV=${2:-}

if [[ -z "$ACTION" || -z "$ENV" ]]; then
  echo "Usage: $0 <deploy|destroy> <env>"
  exit 1
fi

# Repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)" # ✅ Fixed path

# Map env argument to file suffix
case "$ENV" in
dev) ENV_SUFFIX="dev" ;;
staging) ENV_SUFFIX="staging" ;;
prod) ENV_SUFFIX="production" ;;
*)
  echo "❌ Unknown env: $ENV"
  exit 1
  ;;
esac

# Default AWS region
AWS_REGION=${AWS_REGION:-eu-west-3}
export AWS_REGION
export TF_VAR_region="$AWS_REGION"
export TF_VAR_environment="$ENV"

# Function to load all keys from a .env file as TF_VAR_*
load_env_as_tf_vars() {
  local env_file="$1"

  if [[ ! -f "$env_file" ]]; then
    echo "⚠️ Env file not found: $env_file"
    return
  fi

  echo "📢 Loading $env_file"
  set -a
  source "$env_file"
  set +a

  # Export all keys as TF_VAR_*, lowercased
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    tf_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
    export "TF_VAR_$tf_key=$value"
  done < <(grep -v '^#' "$env_file" | grep -v '^$')

  # Debug: show loaded TF_VARs
  echo "📢 Loaded TF_VAR_* for $env_file:"
  env | grep '^TF_VAR_' | sort
  echo "----------------------------------------------"
}

# Deploy/destroy order
PLATFORMS=("worker" "lambda" "client")
[[ "$ACTION" == "destroy" ]] && PLATFORMS=("client" "lambda" "worker")

for PLATFORM in "${PLATFORMS[@]}"; do
  DIR="$REPO_ROOT/infra/$PLATFORM"
  if [[ ! -d "$DIR" ]]; then
    echo "❌ Terraform directory not found: $DIR"
    exit 1
  fi

  echo "=============================================="
  echo "🌐 Terraform $ACTION — $PLATFORM ($ENV)"
  echo "=============================================="

  cd "$DIR"

  # Load the platform-specific .env only
  case "$PLATFORM" in
  worker) load_env_as_tf_vars "$REPO_ROOT/apps/worker/.env.$ENV_SUFFIX" ;;
  lambda) load_env_as_tf_vars "$REPO_ROOT/apps/backend/.env.$ENV_SUFFIX" ;;
  client) load_env_as_tf_vars "$REPO_ROOT/apps/client/.env.$ENV_SUFFIX" ;;
  esac

  # Init Terraform if needed
  if [[ ! -d ".terraform" ]]; then
    cd ~/desktop/api/infra
    terraform init \
      -backend-config="bucket=api-terraform-bucket-state-eu-west-3" \
      -backend-config="key=full-prod/terraform.tfstate" \
      -backend-config="region=eu-west-3"
  fi

  # Deploy or destroy
  if [[ "$ACTION" == "deploy" ]]; then
    terraform apply -auto-approve
  else
    terraform destroy -auto-approve
  fi
done

echo "✅ Terraform $ACTION completed for all platforms."
