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
  name = "api-${var.environment}"
}

# Remove terraform_remote_state references
# Use variables for worker_queue_arn, worker_queue_url

# 1️⃣ ECR Repository
resource "aws_ecr_repository" "repo" {
  name                 = "api-lambda-${var.environment}"
  force_delete         = true
  image_tag_mutability = "MUTABLE"
}

# 2️⃣ Lambda IAM role
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

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Add SQS permissions for backend to enqueue jobs
resource "aws_iam_role_policy" "sqs_policy" {
  name = "${local.name}-sqsPolicy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = var.worker_queue_arn
      }
    ]
  })
}

# 3️⃣ Docker build & push
resource "null_resource" "build_lambda_image" {
  triggers = {
    dockerfile_hash = filemd5("${path.module}/../../.docker/Dockerfile.lambda")
    environment     = var.environment
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      cd ${path.module}/../.. || exit 1
      
      # Check if image exists in ECR
      if aws ecr describe-images \
          --repository-name api-lambda-${var.environment} \
          --image-ids imageTag=${var.environment} \
          --region ${var.region} >/dev/null 2>&1; then
        echo "✅ Image already exists in ECR, skipping build"
        exit 0
      fi
      
      echo "🔐 Logging into ECR..."
      aws ecr get-login-password --region ${var.region} \
        | docker login --username AWS --password-stdin ${aws_ecr_repository.repo.repository_url} 2>&1 | grep -v "error storing credentials" || true
      echo "🐳 Building Lambda image..."
      docker build -t api-lambda-${var.environment} -f .docker/Dockerfile.lambda . || exit 1
      echo "🏷️  Tagging image..."
      docker tag api-lambda-${var.environment} ${aws_ecr_repository.repo.repository_url}:${var.environment} || exit 1
      echo "📤 Pushing to ECR..."
      docker push ${aws_ecr_repository.repo.repository_url}:${var.environment} || exit 1
      echo "✅ Lambda image pushed successfully"
    EOT
  }
}

# 3.5️⃣ Verify image exists in ECR before creating Lambda
resource "null_resource" "verify_lambda_image" {
  triggers = {
    build_id = null_resource.build_lambda_image.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      echo "⏳ Verifying Lambda image in ECR..."
      for i in {1..60}; do
        if aws ecr describe-images \
          --repository-name api-lambda-${var.environment} \
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

  depends_on = [null_resource.build_lambda_image]
}

# 4️⃣ API Gateway (created before Lambda so we can use its endpoint in Lambda env vars)
resource "aws_apigatewayv2_api" "api_gateway" {
  name          = "${local.name}-apiGateway"
  protocol_type = "HTTP"
}

# 5️⃣ Lambda function
resource "aws_lambda_function" "api_lambda" {
  function_name = "${local.name}-apiLambda"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.repo.repository_url}:${var.environment}"
  role          = aws_iam_role.lambda_role.arn
  timeout       = 10
  memory_size   = 512

  environment {
    variables = {
      DATABASE_URL  = var.database_url
      LOG_LEVEL     = var.log_level
      PORT          = var.port
      NODE_ENV      = var.environment
      REGION        = var.region
      SQS_QUEUE_URL = var.worker_queue_url
      API_URL       = aws_apigatewayv2_api.api_gateway.api_endpoint
    }
  }

  depends_on = [null_resource.verify_lambda_image]
}

# 6️⃣ API Gateway Integration
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.api_gateway.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.api_lambda.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api_route" {
  api_id    = aws_apigatewayv2_api.api_gateway.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "api_stage" {
  api_id      = aws_apigatewayv2_api.api_gateway.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_invoke_permission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api_gateway.execution_arn}/*/*"
}

