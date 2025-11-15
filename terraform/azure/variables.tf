variable "api_image" {
  type        = string
  description = "Container registry image for the API"
}

variable "worker_image" {
  type        = string
  description = "Container registry image for the worker"
}

variable "postgres_password" {
  type        = string
  description = "Administrator password"
  sensitive   = true
}
