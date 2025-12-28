variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "lambda_state_backend" {
  description = "Backend configuration for lambda state (for remote state data source) - JSON string"
  type        = string
  default     = "{\"backend\":\"local\",\"config\":{\"path\":\"\"}}"
}

