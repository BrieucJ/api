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

# 1️⃣ ECR repository
resource "aws_ecr_repository" "repo" {
  name                 = local.name
  force_delete         = true
  image_tag_mutability = "MUTABLE"
}

# Build & push Docker image
resource "null_resource" "build_image" {
  triggers = {
    dockerfile_hash = filemd5("${path.module}/../../../.docker/Dockerfile.ecs")
    environment     = var.environment
  }

  provisioner "local-exec" {
    command = <<-EOT
      cd ${path.module}/../../.. &&
      aws ecr get-login-password --region ${var.region} \
        | docker login --username AWS --password-stdin ${aws_ecr_repository.repo.repository_url} &&
      docker build -t ${local.name} -f .docker/Dockerfile.ecs . &&
      docker tag ${local.name} ${aws_ecr_repository.repo.repository_url}:${var.environment} &&
      docker push ${aws_ecr_repository.repo.repository_url}:${var.environment}
    EOT
  }
}

# 2️⃣ Networking
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "sg" {
  name        = "${local.name}-sg"
  description = "Allow HTTP"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 3️⃣ ECS cluster
resource "aws_ecs_cluster" "cluster" {
  name = "${local.name}-cluster"
}

# 4️⃣ Task definition execution role
resource "aws_iam_role" "exec_role" {
  name = "${local.name}-execRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Task definition
resource "aws_ecs_task_definition" "task" {
  family                   = local.name
  cpu                      = "256"
  memory                   = "512"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.exec_role.arn

  container_definitions = jsonencode([
    {
      name      = local.name
      image     = "${aws_ecr_repository.repo.repository_url}:${var.environment}"
      essential = true
      environment = [
        { name = "DATABASE_URL", value = var.database_url },
        { name = "LOG_LEVEL", value = var.log_level },
        { name = "NODE_ENV", value = var.node_env },
        { name = "PORT", value = var.port },
        { name = "REGION", value = var.region }
      ]
      portMappings = [
        {
          containerPort = 80
          protocol      = "tcp"
        }
      ]
    }
  ])

  depends_on = [null_resource.build_image]
}

# 5️⃣ Fargate service
resource "aws_ecs_service" "service" {
  name            = "${local.name}-service"
  cluster         = aws_ecs_cluster.cluster.arn
  task_definition = aws_ecs_task_definition.task.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    assign_public_ip = true
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.sg.id]
  }
}

