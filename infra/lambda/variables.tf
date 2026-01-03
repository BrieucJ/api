variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "info"
}

variable "port" {
  description = "Port number"
  type        = string
  default = "8080"
}

variable "worker_queue_arn" {
  description = "ARN of the worker SQS queue"
  type        = string
}

variable "worker_queue_url" {
  description = "URL of the worker SQS queue"
  type        = string
}

variable "state_backend" {
  description = "Backend configuration passed from root module"
  type        = string
  default     = ""
}

variable "image_tag" {
  description = "Docker image tag (typically git SHA)"
  type        = string
  default     = ""
}

variable "jwt_secret" {
  description = "JWT secret key for token signing (must be at least 32 characters)"
  type        = string
  sensitive   = true
}

variable "jwt_expires_in" {
  description = "JWT token expiration time (e.g., '24h', '7d', '30m')"
  type        = string
  default     = "24h"
}
