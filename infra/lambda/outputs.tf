output "api_lambda_arn" {
  description = "ARN of the API Lambda function"
  value       = aws_lambda_function.api_lambda.arn
}

output "api_lambda_name" {
  description = "Name of the API Lambda function"
  value       = aws_lambda_function.api_lambda.function_name
}

output "api_url" {
  description = "URL of the API Gateway"
  value       = aws_apigatewayv2_api.api_gateway.api_endpoint
}

output "ecr_repo_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.repo.repository_url
}

