variable "environment" {
  description = "Deployment environment (production, staging, dev)"
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
  default     = "8080"
}

variable "worker_mode" {
  description = "Worker mode"
  type        = string
  default     = "lambda"
}

variable "state_backend" {
  description = "Backend configuration"
  type        = string
  default     = ""
}