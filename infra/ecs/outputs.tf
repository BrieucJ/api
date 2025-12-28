output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.cluster.name
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.service.name
}

output "service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.service.arn
}

output "container_image" {
  description = "Container image URI"
  value       = "${aws_ecr_repository.repo.repository_url}:${var.environment}"
}

