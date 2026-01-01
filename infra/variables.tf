variable "environment" {
  description = "Deployment environment (prod, staging, dev)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-3"
}