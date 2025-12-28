terraform {
  backend "s3" {
    # Bucket, region, and dynamodb_table will be set via -backend-config during init
    # key will be set via -backend-config: key = "client-{env}/terraform.tfstate"
    encrypt = true
  }
}

