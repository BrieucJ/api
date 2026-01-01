#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Root Terraform Deployment Script
# Deploys all modules together using the root main.tf
# -----------------------------
# Usage:
#   ./deploy-root.sh deploy prod
#   ./deploy-root.sh destroy staging
# -----------------------------

ACTION=${1:-}
ENV=${2:-}

if [[ -z "$ACTION" || -z "$ENV" ]]; then
  echo "Usage: $0 <deploy|destroy> <env>"
  exit 1
fi

# Repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Map env argument to file suffix
case "$ENV" in
dev) ENV_SUFFIX="dev" ;;
staging) ENV_SUFFIX="staging" ;;
production) ENV_SUFFIX="production" ;;
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
  local label="$2"

  if [[ ! -f "$env_file" ]]; then
    echo "⚠️ Env file not found: $env_file"
    return
  fi

  echo "📢 Loading $label env from: $env_file"
  
  # Read and export variables
  while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" == \#* ]] && continue
    
    # Convert to lowercase for TF_VAR
    tf_key=$(echo "$key" | tr '[:upper:]' '[:lower:]')
    
    # Remove quotes from value if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    export "TF_VAR_$tf_key=$value"
  done < <(grep -v '^#' "$env_file" | grep -v '^$')
}

echo "=============================================="
echo "🌐 Terraform $ACTION — All Modules ($ENV)"
echo "=============================================="

# Load environment variables from backend (for database_url, etc.)
load_env_as_tf_vars "$REPO_ROOT/apps/backend/.env.$ENV_SUFFIX" "Backend"

# Load environment variables from worker (for worker-specific vars)
load_env_as_tf_vars "$REPO_ROOT/apps/worker/.env.$ENV_SUFFIX" "Worker"

# Debug: show loaded TF_VARs
echo "----------------------------------------------"
echo "📢 Loaded TF_VAR_* variables:"
env | grep '^TF_VAR_' | sort
echo "----------------------------------------------"

# Change to root infra directory
cd "$SCRIPT_DIR"

# Validate prerequisites
echo "🔍 Validating prerequisites..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Please install Docker."
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "❌ Docker daemon not running. Please start Docker."
  exit 1
fi

if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not found. Please install AWS CLI."
  exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ AWS credentials not configured or invalid."
  exit 1
fi

echo "✅ All prerequisites validated"
echo "----------------------------------------------"

# Init Terraform if needed
if [[ ! -d ".terraform" ]]; then
  echo "🔧 Initializing Terraform..."
  terraform init \
    -backend-config="bucket=api-terraform-bucket-state-eu-west-3" \
    -backend-config="key=infra-$ENV/terraform.tfstate" \
    -backend-config="region=$AWS_REGION"
fi

# Deploy or destroy
if [[ "$ACTION" == "deploy" ]]; then
  echo "🚀 Deploying infrastructure..."
  if ! terraform apply -auto-approve; then
    echo ""
    echo "❌ Deployment failed!"
    echo "💡 Tip: Check Docker is running and AWS credentials are valid"
    exit 1
  fi
elif [[ "$ACTION" == "destroy" ]]; then
  echo "💣 Destroying infrastructure..."
  if ! terraform destroy -auto-approve; then
    echo ""
    echo "⚠️  Destroy had issues. Some resources may remain."
    exit 1
  fi
elif [[ "$ACTION" == "plan" ]]; then
  echo "📋 Planning infrastructure changes..."
  terraform plan
else
  echo "❌ Unknown action: $ACTION"
  echo "Valid actions: deploy, destroy, plan"
  exit 1
fi

echo ""
echo "✅ Terraform $ACTION completed successfully!"

