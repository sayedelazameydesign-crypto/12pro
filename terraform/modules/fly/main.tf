# Terraform Module - Fly.io - CeliaOS v1.0.0 - Option C - $0 Cost (Terraform free)
# Improves v1.0.0 deployments - one-command, reproducible, auditable

terraform {
  required_providers {
    fly = {
      source = "fly-apps/fly"
      version = "~> 0.0.23"
    }
  }
}

variable "app_name" {
  description = "Fly.io app name"
  type        = string
  default     = "celiaos"
}

variable "region" {
  description = "Fly.io region"
  type        = string
  default     = "cdg" # Paris - close to Cairo
}

variable "volume_size" {
  description = "Persistent volume size in GB"
  type        = number
  default     = 10
}

variable "env_vars" {
  description = "Environment variables"
  type        = map(string)
  default = {
    NODE_ENV = "production"
    # DATABASE_URL not set for v1.0.0 (File JSON) - set for v1.1.0 Postgres
    # OLLAMA_BASE_URL = "http://ollama:11434" # If using Fly.io Ollama
  }
}

variable "secrets" {
  description = "Secrets (will be set via fly secrets)"
  type        = map(string)
  default     = {}
  sensitive   = true
}

# Fly.io app
resource "fly_app" "celiaos" {
  name = var.app_name
  org  = "personal" # Change to your org
}

# Persistent volume for File JSON persistence - CRITICAL for v1.0.0
# Without volume, File JSON will be lost on redeploy (Gap #2)
resource "fly_volume" "celiaos_data" {
  app    = fly_app.celiaos.name
  name   = "celiaos_data"
  region = var.region
  size   = var.volume_size
  
  # This volume is mounted to /app/certification where memories.json and missions.json live
  # See docs/HOSTING-REQUIREMENTS.md
}

# Fly.io machine
resource "fly_machine" "celiaos" {
  app    = fly_app.celiaos.name
  region = var.region
  name   = "${var.app_name}-machine"
  
  image = "ghcr.io/sayedelazameydesign-crypto/12pro:v1.0.0"
  
  cpus     = 1
  memory   = 1024 # 1GB
  cputype  = "shared"
  
  env = var.env_vars
  
  services = [
    {
      ports = [
        {
          port     = 443
          handlers = ["tls", "http"]
        },
        {
          port     = 80
          handlers = ["http"]
        }
      ]
      protocol = "tcp"
      internal_port = 3001 # api-server port
    }
  ]
  
  mounts = [
    {
      volume = fly_volume.celiaos_data.id
      path   = "/app/certification" # Where File JSON persistence lives
    }
  ]
  
  # Health checks
  checks = [
    {
      type     = "http"
      port     = 3001
      path     = "/api/v1/health"
      interval = "30s"
      timeout  = "5s"
    }
  ]
}

# Outputs
output "app_name" {
  value = fly_app.celiaos.name
}

output "app_url" {
  value = "https://${fly_app.celiaos.name}.fly.dev"
}

output "volume_id" {
  value = fly_volume.celiaos_data.id
}

output "volume_size" {
  value = fly_volume.celiaos_data.size
}

output "deployment_instructions" {
  value = <<-EOT
    CeliaOS v1.0.0 deployed to Fly.io with persistent volume
    
    App: ${fly_app.celiaos.name}
    URL: https://${fly_app.celiaos.name}.fly.dev
    Volume: ${fly_volume.celiaos_data.id} (${fly_volume.celiaos_data.size}GB) mounted to /app/certification
    Region: ${var.region}
    
    Verification:
    curl https://${fly_app.celiaos.name}.fly.dev/api/v1/health
    # Should return {"status":"ok"}
    
    curl https://${fly_app.celiaos.name}.fly.dev/api/v1/sse/stats
    # Should return {"clients":0,"maxClients":100}
    
    Rollback (if needed):
    fly deploy --image ghcr.io/sayedelazameydesign-crypto/12pro:v0.9.0 -a ${fly_app.celiaos.name}
    # Should rollback in <5 min - see docs/ROLLBACK-PLAN.md
    
    Cost: ~$5/month + usage (Fly.io pricing)
    For $0 budget: Use local Docker or Colab + Google Drive
    
    Next: v1.1.0 will add Postgres for Vercel/Lambda support
  EOT
}
