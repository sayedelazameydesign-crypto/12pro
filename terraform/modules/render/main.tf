# Terraform Module - Render - CeliaOS v1.0.0 - Option C - $0 Cost (Terraform free)

terraform {
  required_providers {
    render = {
      source = "render-oss/render"
      version = "~> 1.0"
    }
  }
}

variable "service_name" {
  description = "Render service name"
  type        = string
  default     = "celiaos"
}

variable "region" {
  description = "Render region"
  type        = string
  default     = "frankfurt" # Close to Cairo
}

variable "disk_size" {
  description = "Persistent disk size in GB"
  type        = number
  default     = 10
}

variable "env_vars" {
  description = "Environment variables"
  type        = map(string)
  default = {
    NODE_ENV = "production"
  }
}

# Render service - Docker
resource "render_service" "celiaos" {
  name         = var.service_name
  type         = "web_service"
  region       = var.region
  plan         = "starter" # $7/month, or free with cold boots
  branch       = "main"
  auto_deploy  = false # Manual deploy via tag
  
  # Docker
  dockerfile_path = "./Dockerfile"
  docker_context  = "."
  
  # Health check
  health_check_path = "/api/v1/health"
  
  # Persistent disk for File JSON persistence - CRITICAL
  disk {
    name       = "celiaos-data"
    mount_path = "/app/certification"
    size_gb    = var.disk_size
  }
  
  # Environment
  env_vars = var.env_vars
  
  # Scaling
  num_instances = 1
}

output "service_name" {
  value = render_service.celiaos.name
}

output "service_url" {
  value = render_service.celiaos.service_details[0].url
}

output "deployment_instructions" {
  value = <<-EOT
    CeliaOS v1.0.0 deployed to Render with persistent disk
    
    Service: ${render_service.celiaos.name}
    URL: ${render_service.celiaos.service_details[0].url}
    Disk: ${var.disk_size}GB mounted to /app/certification
    Region: ${var.region}
    
    Verification:
    curl ${render_service.celiaos.service_details[0].url}/api/v1/health
    
    Cost: $7/month starter, or free tier with cold boots after 15 min
    For $0 budget: Use local Docker or Colab + Google Drive
    
    Note: Free tier cold boots after 15 min - for production, use starter plan
    v1.1.0 Postgres will enable Vercel/Lambda (serverless) with $0 cold boot handling
  EOT
}
