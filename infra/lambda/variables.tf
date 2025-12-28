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
  default     = "3000"
}

variable "worker_state_backend" {
  description = "Backend configuration for worker state (for remote state data source) - JSON string"
  type        = string
  default     = "{\"backend\":\"local\",\"config\":{\"path\":\"\"}}"
}

variable "client_state_backend" {
  description = "Backend configuration for client state (optional, for remote state data source) - JSON string"
  type        = string
  default     = ""
}

