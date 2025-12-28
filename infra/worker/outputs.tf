output "worker_lambda_arn" {
  description = "ARN of the worker Lambda function"
  value       = aws_lambda_function.worker_lambda.arn
}

output "worker_lambda_name" {
  description = "Name of the worker Lambda function"
  value       = aws_lambda_function.worker_lambda.function_name
}

output "queue_url" {
  description = "URL of the SQS queue"
  value       = aws_sqs_queue.queue.url
}

output "queue_arn" {
  description = "ARN of the SQS queue"
  value       = aws_sqs_queue.queue.arn
}

output "dlq_url" {
  description = "URL of the dead letter queue"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "ARN of the dead letter queue"
  value       = aws_sqs_queue.dlq.arn
}

output "ecr_repo_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.repo.repository_url
}

