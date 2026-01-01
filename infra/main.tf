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
}

# --- Client Module ---
module "client" {
  source        = "./client"
  environment   = var.environment
  region        = var.region
  api_url       = module.lambda.api_url
}
