# --- Outputs ---
output "worker_queue_arn" {
  value = module.worker.queue_arn
}

output "worker_queue_url" {
  value = module.worker.queue_url
}

output "lambda_api_url" {
  value = module.lambda.api_url
}

output "client_distribution_url" {
  value = module.client.distribution_url
}