#!/usr/bin/env bash
set -euo pipefail

ACTION=${1:-}
ENV=${2:-}

if [[ -z "$ACTION" || -z "$ENV" ]]; then
  echo "Usage: $0 <deploy|destroy> <env>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

case "$ENV" in
dev) ENV_SUFFIX="dev" ;;
staging) ENV_SUFFIX="staging" ;;
prod) ENV_SUFFIX="production" ;;
*)
  echo "❌ Unknown env: $ENV"
  exit 1
  ;;
esac

AWS_REGION=${AWS_REGION:-eu-west-3}
export AWS_REGION
export TF_VAR_region="$AWS_REGION"
export TF_VAR_environment="$ENV"

load_env_as_tf_vars() {
  local env_file="$1"
  local before after

  before="$(mktemp)"
  after="$(mktemp)"

  env | sort >"$before"
  set -a
  source "$env_file"
  set +a
  env | sort >"$after"

  comm -13 "$before" "$after" | while IFS='=' read -r key value; do
    export "TF_VAR_$key=$value"
  done

  rm -f "$before" "$after"
}

load_env_as_tf_vars "$REPO_ROOT/apps/backend/.env.$ENV_SUFFIX"
load_env_as_tf_vars "$REPO_ROOT/apps/worker/.env.$ENV_SUFFIX"

echo "📢 Loaded Terraform variables:"
env | grep '^TF_VAR_' | sort
echo "----------------------------------------------"

PLATFORMS=("worker" "lambda" "client")
[[ "$ACTION" == "destroy" ]] && PLATFORMS=("client" "lambda" "worker")

for PLATFORM in "${PLATFORMS[@]}"; do
  cd "$REPO_ROOT/infra/$PLATFORM"

  if [[ ! -d ".terraform" ]]; then
    terraform init \
      -backend-config="bucket=api-terraform-bucket-state-eu-west-3" \
      -backend-config="key=$PLATFORM-$ENV/terraform.tfstate" \
      -backend-config="region=$AWS_REGION"
  fi

  if [[ "$ACTION" == "deploy" ]]; then
    terraform apply -auto-approve
  else
    terraform destroy -auto-approve
  fi
done

echo "✅ Terraform $ACTION completed."
