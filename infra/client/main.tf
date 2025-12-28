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
  name                 = "client-${var.environment}"
  lambda_backend_config = jsondecode(var.lambda_state_backend)
}

# Reference lambda stack to get API URL

data "terraform_remote_state" "lambda" {
  backend = local.lambda_backend_config.backend
  config  = local.lambda_backend_config.config
}

# 1️⃣ S3 Bucket for static website hosting
resource "aws_s3_bucket" "bucket" {
  bucket        = "${local.name}-bucket"
  force_destroy = true
}

# Block public access (CloudFront will access via OAC)
resource "aws_s3_bucket_public_access_block" "public_access_block" {
  bucket = aws_s3_bucket.bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2️⃣ Build client with API URL
resource "null_resource" "build_client" {
  triggers = {
    api_url    = data.terraform_remote_state.lambda.outputs.api_url
    environment = var.environment
  }

  provisioner "local-exec" {
    command = <<-EOT
      cd ${path.module}/../../.. &&
      cd apps/client &&
      export VITE_BACKEND_URL="${data.terraform_remote_state.lambda.outputs.api_url}" &&
      bun install --frozen-lockfile &&
      bun run build
    EOT
  }

  depends_on = [aws_s3_bucket.bucket]
}

# 3️⃣ Upload files to S3
resource "null_resource" "upload_files" {
  triggers = {
    build_id = null_resource.build_client.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      cd ${path.module}/../../.. &&
      cd apps/client &&
      aws s3 sync dist/ s3://${aws_s3_bucket.bucket.id}/ \
        --region ${var.region} \
        --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --exclude "*.html" &&
      aws s3 sync dist/ s3://${aws_s3_bucket.bucket.id}/ \
        --region ${var.region} \
        --delete \
        --cache-control "public, max-age=0, must-revalidate" \
        --include "*.html"
    EOT
  }

  depends_on = [null_resource.build_client]
}

# 4️⃣ CloudFront Origin Access Control (OAC) - modern replacement for OAI
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${local.name}-oac"
  description                       = "OAC for ${local.name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                   = "always"
  signing_protocol                  = "sigv4"
}

# 5️⃣ CloudFront Distribution
resource "aws_cloudfront_distribution" "distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    origin_id                = aws_s3_bucket.bucket.arn
    domain_name              = aws_s3_bucket.bucket.bucket_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    target_origin_id       = aws_s3_bucket.bucket.arn
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl  = 3600
    max_ttl     = 86400
  }

  # Handle SPA routing - return index.html for 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  depends_on = [aws_cloudfront_origin_access_control.oac, null_resource.upload_files]
}

# 6️⃣ S3 Bucket Policy for CloudFront OAC
# OAC uses CloudFront service principal with distribution ARN condition
resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = aws_s3_bucket.bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.distribution.arn
          }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket.bucket,
    aws_s3_bucket_public_access_block.public_access_block,
    aws_cloudfront_distribution.distribution,
    aws_cloudfront_origin_access_control.oac
  ]
}

# 7️⃣ Force CloudFront to re-validate origin after bucket policy is created
# This updates the distribution comment, which triggers origin re-validation
resource "null_resource" "update_distribution" {
  triggers = {
    distribution_id = aws_cloudfront_distribution.distribution.id
    bucket_policy_id = aws_s3_bucket_policy.bucket_policy.id
  }

  provisioner "local-exec" {
    command = <<-EOT
      DIST_ID="${aws_cloudfront_distribution.distribution.id}" &&
      aws cloudfront get-distribution-config --id $DIST_ID --output json > /tmp/dist-config-$DIST_ID.json &&
      ETAG=$(jq -r '.ETag' /tmp/dist-config-$DIST_ID.json) &&
      jq '.DistributionConfig.Comment = "Updated after bucket policy - $(date +%s)" | .DistributionConfig' /tmp/dist-config-$DIST_ID.json > /tmp/dist-config-updated-$DIST_ID.json &&
      aws cloudfront update-distribution --id $DIST_ID --if-match "$ETAG" --distribution-config file:///tmp/dist-config-updated-$DIST_ID.json > /dev/null 2>&1 || echo "Distribution update may have failed, but this is expected on first run"
    EOT
  }

  depends_on = [aws_s3_bucket_policy.bucket_policy, aws_cloudfront_distribution.distribution]
}

