terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
  backend "s3" {
    bucket = "api-terraform-bucket-state-eu-west-3"
    region = "eu-west-3"
  }
}

provider "aws" {
  region = var.region
}

# --- Worker Module ---
module "worker" {
  source        = "./worker"
  environment   = var.environment
  database_url  = var.database_url
  region        = var.region
  worker_mode   = var.worker_mode
  log_level     = var.log_level
  port          = var.port
}

# --- Lambda Module ---
module "lambda" {
  source                  = "./lambda"
  environment             = var.environment
  region                  = var.region
  database_url            = var.database_url
  log_level               = var.log_level
  port                    = var.port
  worker_queue_arn        = module.worker.queue_arn
  worker_queue_url        = module.worker.queue_url
  client_distribution_url = "" # Will be set via environment variable after first deploy
}

# --- Client Module ---
module "client" {
  source        = "./client"
  environment   = var.environment
  region        = var.region
  api_url       = module.lambda.api_url
}

# --- Update Lambda with Client URL ---
# This runs after both Lambda and Client are deployed
# It updates the Lambda environment variable with the CloudFront URL for CORS
resource "null_resource" "update_lambda_with_client_url" {
  triggers = {
    client_url = module.client.distribution_url
    lambda_name = module.lambda.api_lambda_name
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      echo "🔄 Updating Lambda with Client URL: ${module.client.distribution_url}"
      
      # Get existing environment variables
      CURRENT_ENV=$(aws lambda get-function-configuration \
        --function-name ${module.lambda.api_lambda_name} \
        --region ${var.region} \
        --query 'Environment.Variables' \
        --output json)
      
      # Add CONSOLE_FRONTEND_URL to existing variables and wrap in Variables key
      UPDATED_ENV=$(echo "$CURRENT_ENV" | jq '{Variables: (. + {"CONSOLE_FRONTEND_URL": "${module.client.distribution_url}"})}')
      
      # Write to temp file (AWS CLI needs file:// for JSON)
      TEMP_FILE=$(mktemp)
      echo "$UPDATED_ENV" > "$TEMP_FILE"
      
      # Update Lambda function configuration using file
      aws lambda update-function-configuration \
        --function-name ${module.lambda.api_lambda_name} \
        --environment "file://$TEMP_FILE" \
        --region ${var.region} > /dev/null
      
      # Clean up temp file
      rm "$TEMP_FILE"
      
      echo "✅ Lambda environment updated with CONSOLE_FRONTEND_URL"
      
      # Wait for update to complete
      aws lambda wait function-updated \
        --function-name ${module.lambda.api_lambda_name} \
        --region ${var.region}
      
      echo "✅ Lambda update complete and ready"
    EOT
  }

  depends_on = [module.client, module.lambda]
}
