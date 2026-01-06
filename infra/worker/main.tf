terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.region
}

locals {
  name = "worker-${var.environment}"
}

# Get AWS account ID
data "aws_caller_identity" "current" {}

# 1️⃣ ECR Repository
resource "aws_ecr_repository" "repo" {
  name                 = local.name
  force_delete         = true
  image_tag_mutability = "MUTABLE"
}

# 2️⃣ SQS Queue with DLQ
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name}-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "queue" {
  name                      = "${local.name}-queue"
  message_retention_seconds = 345600  # 4 days
  visibility_timeout_seconds = 900    # 5 minutes
  receive_wait_time_seconds  = 20      # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

# 3️⃣ Lambda IAM Role
resource "aws_iam_role" "lambda_role" {
  name = "${local.name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Basic execution role
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# SQS permissions
resource "aws_iam_role_policy" "sqs_policy" {
  name = "${local.name}-sqsPolicy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.queue.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.dlq.arn
      }
    ]
  })
}

# EventBridge permissions
resource "aws_iam_role_policy" "eventbridge_policy" {
  name = "${local.name}-eventbridgePolicy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "events:PutRule",
          "events:PutTargets",
          "events:DeleteRule",
          "events:RemoveTargets",
          "events:ListRules"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:AddPermission",
          "lambda:RemovePermission"
        ]
        Resource = "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${local.name}-lambda"
      }
    ]
  })
}

# 4️⃣ Docker build & push (only runs if image_tag not provided, i.e., local deployment)
resource "null_resource" "build_worker_image" {
  count = var.image_tag == "" ? 1 : 0

  triggers = {
    dockerfile_hash = filemd5("${path.module}/../../.docker/Dockerfile.worker")
    environment     = var.environment
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      cd ${path.module}/../.. || exit 1
      echo "🔐 Logging into ECR..."
      aws ecr get-login-password --region ${var.region} \
        | docker login --username AWS --password-stdin ${aws_ecr_repository.repo.repository_url} 2>&1 | grep -v "error storing credentials" || true
      echo "🐳 Building Worker image..."
      docker build -t ${local.name} -f .docker/Dockerfile.worker . || exit 1
      echo "🏷️  Tagging image..."
      docker tag ${local.name} ${aws_ecr_repository.repo.repository_url}:${var.environment} || exit 1
      echo "📤 Pushing to ECR..."
      docker push ${aws_ecr_repository.repo.repository_url}:${var.environment} || exit 1
      echo "✅ Worker image pushed successfully"
    EOT
  }
}

# 4.5️⃣ Verify image exists in ECR before creating Lambda
resource "null_resource" "verify_worker_image" {
  count = var.image_tag == "" ? 1 : 0

  triggers = {
    build_id = null_resource.build_worker_image[0].id
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      echo "⏳ Verifying Worker image in ECR..."
      for i in {1..60}; do
        if aws ecr describe-images \
          --repository-name worker-${var.environment} \
          --image-ids imageTag=${var.environment} \
          --region ${var.region} >/dev/null 2>&1; then
          echo "✅ Image verified in ECR"
          exit 0
        fi
        echo "Waiting for image... (attempt $i/60)"
        sleep 5
      done
      echo "❌ ERROR: Image not found in ECR after 5 minutes"
      exit 1
    EOT
  }

  depends_on = [null_resource.build_worker_image]
}

# 5️⃣ Lambda function
resource "aws_lambda_function" "worker_lambda" {
  function_name = "${local.name}-lambda"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.repo.repository_url}:${var.image_tag != "" ? var.image_tag : var.environment}"
  role          = aws_iam_role.lambda_role.arn
  timeout       = 900 # 15 minutes
  memory_size   = 512

  environment {
    variables = {
      DATABASE_URL  = var.database_url
      LOG_LEVEL     = var.log_level
      NODE_ENV      = var.environment
      PORT          = var.port
      REGION        = var.region
      WORKER_MODE   = var.worker_mode
      SQS_QUEUE_URL = aws_sqs_queue.queue.url
      LAMBDA_ARN    = "arn:aws:lambda:${var.region}:${data.aws_caller_identity.current.account_id}:function:${local.name}-lambda"
    }
  }

  # Depend on verification (only used when building locally, ignored otherwise)
  depends_on = [null_resource.verify_worker_image]
}

# 6️⃣ SQS Event Source Mapping
resource "aws_lambda_event_source_mapping" "sqs_mapping" {
  event_source_arn                   = aws_sqs_queue.queue.arn
  function_name                      = aws_lambda_function.worker_lambda.arn
  batch_size                         = 1 # Process one message at a time
  maximum_batching_window_in_seconds = 5
}

# 7️⃣ EventBridge permission for Lambda
# Allow EventBridge to invoke this Lambda function
# Using rule/* to allow all EventBridge rules in this account/region
resource "aws_lambda_permission" "eventbridge_permission" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.worker_lambda.function_name
  principal     = "events.amazonaws.com"
  source_arn    = "arn:aws:events:${var.region}:${data.aws_caller_identity.current.account_id}:rule/*"
}

# 8️⃣ API Gateway HTTP API for worker Lambda
resource "aws_apigatewayv2_api" "worker_api" {
  name          = "${local.name}-apiGateway"
  protocol_type = "HTTP"
}

# 9️⃣ API Gateway Integration
resource "aws_apigatewayv2_integration" "worker_lambda_integration" {
  api_id           = aws_apigatewayv2_api.worker_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.worker_lambda.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

# 🔟 API Gateway Routes
resource "aws_apigatewayv2_route" "worker_api_route" {
  api_id    = aws_apigatewayv2_api.worker_api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.worker_lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "worker_api_stage" {
  api_id      = aws_apigatewayv2_api.worker_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }
}

# 1️⃣1️⃣ Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway_permission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.worker_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.worker_api.execution_arn}/*/*"
}

