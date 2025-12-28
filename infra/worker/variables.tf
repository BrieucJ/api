variable "environment" {
  description = "Environment name (prod, staging, dev)"
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
  default     = ""
  sensitive   = true
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "info"
}

variable "node_env" {
  description = "Node environment"
  type        = string
  default     = "production"
}

variable "port" {
  description = "Port number"
  type        = string
  default     = "8081"
}

variable "worker_mode" {
  description = "Worker mode"
  type        = string
  default     = "lambda"
}

