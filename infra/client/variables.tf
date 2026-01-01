variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}

variable "api_url" {
  description = "API Gateway URL from lambda module"
  type        = string
  default     = ""
}

variable "state_backend" {
  description = "Backend configuration passed from root module"
  type        = string
  default     = ""
}
