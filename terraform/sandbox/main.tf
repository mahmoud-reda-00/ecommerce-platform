terraform {
  required_version = ">= 1.5"

  backend "s3" {
    bucket = "ecommerce-tfstate-627633792696"
    key    = "sandbox/terraform.tfstate"
    region = "eu-central-1"
    use_lockfile = true
    
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "eu-central-1"
}

resource "aws_s3_bucket" "test" {
  bucket = "ecommerce-tf-test-627633792696"
}