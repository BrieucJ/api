#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PLATFORM=${1:-}
ENV=${2:-}
ACTION=${3:-}

if [[ -z "$PLATFORM" || -z "$ENV" || -z "$ACTION" ]]; then
  echo "Usage: $0 <platform> <env> <init|plan|apply|destroy>"
  echo "  platform: worker|lambda|client|ecs"
  echo "  env: prod|staging"
  echo "  action: init|plan|apply|destroy"
  exit 1
fi

TERRAFORM_DIR="$SCRIPT_DIR/$PLATFORM"

if [[ ! -d "$TERRAFORM_DIR" ]]; then
  echo "❌ Terraform directory not found: $TERRAFORM_DIR"
  exit 1
fi

cd "$TERRAFORM_DIR"

# Map environment to env file name
# prod -> env.production, staging -> env.staging, default -> env.dev
if [[ "$ENV" == "prod" ]]; then
  ENV_FILE_NAME="env.production"
elif [[ "$ENV" == "staging" ]]; then
  ENV_FILE_NAME="env.staging"
else
  ENV_FILE_NAME="env.dev"
fi

# Determine which env file to load based on platform
if [[ "$PLATFORM" == "lambda" || "$PLATFORM" == "ecs" ]]; then
  ENV_FILE_PATH="$REPO_ROOT/apps/backend/$ENV_FILE_NAME"
elif [[ "$PLATFORM" == "worker" ]]; then
  ENV_FILE_PATH="$REPO_ROOT/apps/worker/$ENV_FILE_NAME"
else
  ENV_FILE_PATH="$REPO_ROOT/apps/backend/$ENV_FILE_NAME"
fi

# Load environment variables from env file if it exists
if [[ -f "$ENV_FILE_PATH" ]]; then
  echo "📋 Loading environment from: $ENV_FILE_PATH"
  set -a
  source "$ENV_FILE_PATH"
  set +a
fi

# Set default region if not set
export AWS_REGION=${REGION:-${AWS_REGION:-eu-west-3}}

# S3 backend configuration (can be overridden via environment variables)
TERRAFORM_STATE_BUCKET=${TERRAFORM_STATE_BUCKET:-"terraform-state-bucket"}
TERRAFORM_STATE_REGION=${TERRAFORM_STATE_REGION:-${AWS_REGION}}
TERRAFORM_STATE_DYNAMODB_TABLE=${TERRAFORM_STATE_DYNAMODB_TABLE:-""}

# Prepare terraform variables
TF_VARS=()
if [[ -f "$ENV_FILE_PATH" ]]; then
  # Convert env file to terraform variables
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^# ]] && continue
    # Remove quotes from value if present
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    TF_VARS+=("-var" "${key}=${value}")
  done < "$ENV_FILE_PATH"
fi

# Add environment variable
TF_VARS+=("-var" "environment=$ENV")

# Prepare backend config for S3
BACKEND_CONFIG=(
  "-backend-config=bucket=$TERRAFORM_STATE_BUCKET"
  "-backend-config=key=$PLATFORM-$ENV/terraform.tfstate"
  "-backend-config=region=$TERRAFORM_STATE_REGION"
)

# Add DynamoDB table only if specified (optional - used for state locking)
if [[ -n "$TERRAFORM_STATE_DYNAMODB_TABLE" ]]; then
  BACKEND_CONFIG+=("-backend-config=dynamodb_table=$TERRAFORM_STATE_DYNAMODB_TABLE")
fi

# Add remote state backend config for lambda and client (using S3)
# Build the base remote state config JSON
if [[ -n "$TERRAFORM_STATE_DYNAMODB_TABLE" ]]; then
  REMOTE_STATE_BASE="{\"backend\":\"s3\",\"config\":{\"bucket\":\"$TERRAFORM_STATE_BUCKET\",\"region\":\"$TERRAFORM_STATE_REGION\",\"dynamodb_table\":\"$TERRAFORM_STATE_DYNAMODB_TABLE\",\"encrypt\":true}}"
else
  REMOTE_STATE_BASE="{\"backend\":\"s3\",\"config\":{\"bucket\":\"$TERRAFORM_STATE_BUCKET\",\"region\":\"$TERRAFORM_STATE_REGION\",\"encrypt\":true}}"
fi

if [[ "$PLATFORM" == "lambda" ]]; then
  WORKER_STATE_KEY="worker-$ENV/terraform.tfstate"
  WORKER_CONFIG=$(echo "$REMOTE_STATE_BASE" | sed "s|\"encrypt\":true|\"key\":\"$WORKER_STATE_KEY\",\"encrypt\":true|")
  TF_VARS+=("-var" "worker_state_backend=$WORKER_CONFIG")
  
  # Optional: client state (if it exists)
  CLIENT_STATE_KEY="client-$ENV/terraform.tfstate"
  CLIENT_CONFIG=$(echo "$REMOTE_STATE_BASE" | sed "s|\"encrypt\":true|\"key\":\"$CLIENT_STATE_KEY\",\"encrypt\":true|")
  TF_VARS+=("-var" "client_state_backend=$CLIENT_CONFIG")
elif [[ "$PLATFORM" == "client" ]]; then
  LAMBDA_STATE_KEY="lambda-$ENV/terraform.tfstate"
  LAMBDA_CONFIG=$(echo "$REMOTE_STATE_BASE" | sed "s|\"encrypt\":true|\"key\":\"$LAMBDA_STATE_KEY\",\"encrypt\":true|")
  TF_VARS+=("-var" "lambda_state_backend=$LAMBDA_CONFIG")
fi

# Initialize terraform if needed
if [[ "$ACTION" != "init" ]] && [[ ! -d ".terraform" ]]; then
  echo "🔧 Initializing Terraform..."
  terraform init "${BACKEND_CONFIG[@]}"
fi

# Execute terraform command
case "$ACTION" in
  init)
    terraform init "${BACKEND_CONFIG[@]}"
    ;;
  plan)
    terraform plan "${TF_VARS[@]}" -out=tfplan
    ;;
  apply)
    if [[ -f "tfplan" ]]; then
      terraform apply tfplan
    else
      terraform apply -auto-approve "${TF_VARS[@]}"
    fi
    ;;
  destroy)
    terraform destroy -auto-approve "${TF_VARS[@]}"
    ;;
  *)
    echo "❌ Invalid action: $ACTION (must be init|plan|apply|destroy)"
    exit 1
    ;;
esac

