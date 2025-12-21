#!/usr/bin/env bash
set -euo pipefail

# Local testing script for Pulumi deployments
# This mimics the GitHub Actions workflow for local testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check required environment variables
check_env_var() {
  local var_name=$1
  if [[ -z "${!var_name:-}" ]]; then
    echo -e "${RED}❌ Missing required environment variable: $var_name${NC}"
    return 1
  fi
  return 0
}

echo -e "${GREEN}🚀 Starting local Pulumi deployment test${NC}\n"

# Check for required variables
echo -e "${YELLOW}Checking environment variables...${NC}"
MISSING_VARS=0

check_env_var "DATABASE_URL" || MISSING_VARS=1
check_env_var "AWS_ACCESS_KEY_ID" || MISSING_VARS=1
check_env_var "AWS_SECRET_ACCESS_KEY" || MISSING_VARS=1

# Set defaults for optional variables
export NODE_ENV="${NODE_ENV:-production}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export PORT="${PORT:-8080}"
export AWS_REGION="${AWS_REGION:-eu-west-3}"
export WORKER_MODE="${WORKER_MODE:-lambda}"

if [[ $MISSING_VARS -eq 1 ]]; then
  echo -e "\n${RED}❌ Please set the missing environment variables:${NC}"
  echo -e "  export DATABASE_URL='your-database-url'"
  echo -e "  export AWS_ACCESS_KEY_ID='your-access-key'"
  echo -e "  export AWS_SECRET_ACCESS_KEY='your-secret-key'"
  echo -e "\nOptional:"
  echo -e "  export LOG_LEVEL='info'"
  echo -e "  export PORT='8080'"
  echo -e "  export AWS_REGION='eu-west-3'"
  exit 1
fi

echo -e "${GREEN}✅ All required environment variables are set${NC}\n"

# Ask what to deploy
echo -e "${YELLOW}What would you like to deploy?${NC}"
echo "1) Backend Lambda only"
echo "2) Worker Lambda only"
echo "3) Client only"
echo "4) All (Backend → Worker → Client)"
echo "5) Test client build only (no deployment)"
read -p "Enter choice [1-5]: " choice

case $choice in
  1)
    echo -e "\n${GREEN}Deploying Backend Lambda...${NC}"
    cd infra
    bash pulumi-run.sh lambda prod up
    echo -e "\n${GREEN}✅ Backend deployed!${NC}"
    echo -e "Getting API URL..."
    bun x pulumi stack output apiUrl --stack lambda-prod
    ;;
    
  2)
    echo -e "\n${GREEN}Deploying Worker Lambda...${NC}"
    cd infra
    bash pulumi-run.sh worker prod up
    echo -e "\n${GREEN}✅ Worker deployed!${NC}"
    ;;
    
  3)
    echo -e "\n${YELLOW}⚠️  Client deployment requires Backend API URL${NC}"
    read -p "Enter Backend API URL (or press Enter to skip client build): " api_url
    
    if [[ -n "$api_url" ]]; then
      echo -e "\n${GREEN}Building client with API URL: $api_url${NC}"
      cd apps/client
      export VITE_BACKEND_URL="$api_url"
      bun install --frozen-lockfile
      bun run build
      echo -e "\n${GREEN}✅ Client built!${NC}"
      
      echo -e "\n${GREEN}Deploying Client...${NC}"
      cd ../../infra
      bash pulumi-run.sh client prod up
      echo -e "\n${GREEN}✅ Client deployed!${NC}"
      bun x pulumi stack output distributionUrl --stack client-prod
    else
      echo -e "${YELLOW}Skipping client build${NC}"
    fi
    ;;
    
  4)
    echo -e "\n${GREEN}Deploying Backend Lambda...${NC}"
    cd infra
    bash pulumi-run.sh lambda prod up
    
    echo -e "\n${GREEN}Getting Backend API URL...${NC}"
    API_URL=$(bun x pulumi stack output apiUrl --stack lambda-prod --json 2>/dev/null | tr -d '"' || echo "")
    
    if [[ -z "$API_URL" ]]; then
      echo -e "${RED}❌ Failed to get API URL from Pulumi stack${NC}"
      exit 1
    fi
    
    echo -e "${GREEN}Backend API URL: $API_URL${NC}\n"
    
    echo -e "${GREEN}Deploying Worker Lambda...${NC}"
    bash pulumi-run.sh worker prod up
    
    echo -e "\n${GREEN}Building Client with API URL: $API_URL${NC}"
    cd ../apps/client
    export VITE_BACKEND_URL="$API_URL"
    bun install --frozen-lockfile
    bun run build
    echo -e "${GREEN}✅ Client built!${NC}"
    
    echo -e "\n${GREEN}Deploying Client...${NC}"
    cd ../../infra
    bash pulumi-run.sh client prod up
    
    echo -e "\n${GREEN}✅ All services deployed!${NC}\n"
    echo -e "${GREEN}Backend URL:${NC} $API_URL"
    CLIENT_URL=$(bun x pulumi stack output distributionUrl --stack client-prod --json 2>/dev/null | tr -d '"' || echo "")
    if [[ -n "$CLIENT_URL" ]]; then
      echo -e "${GREEN}Client URL:${NC} $CLIENT_URL"
    fi
    ;;
    
  5)
    echo -e "\n${YELLOW}Enter Backend API URL for client build:${NC}"
    read -p "API URL: " api_url
    
    if [[ -z "$api_url" ]]; then
      echo -e "${YELLOW}Using default: http://localhost:8080${NC}"
      api_url="http://localhost:8080"
    fi
    
    echo -e "\n${GREEN}Building client with API URL: $api_url${NC}"
    cd apps/client
    export VITE_BACKEND_URL="$api_url"
    bun install --frozen-lockfile
    bun run build
    
    echo -e "\n${GREEN}✅ Client build complete!${NC}"
    echo -e "Build output: apps/client/dist"
    ;;
    
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo -e "\n${GREEN}✨ Done!${NC}"

