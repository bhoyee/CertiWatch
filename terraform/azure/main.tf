terraform {
  required_version = ">= 1.8.0"
  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = ">= 1.12.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.110.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "prefix" {
  type        = string
  description = "Resource prefix"
}

variable "location" {
  type    = string
  default = "westeurope"
}

resource "azurerm_resource_group" "rg" {
  name     = "${var.prefix}-rg"
  location = var.location
}

resource "azurerm_container_app_environment" "cae" {
  name                       = "${var.prefix}-cae"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = var.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.prefix}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app" "api" {
  name                         = "${var.prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name

  template {
    container {
      name   = "api"
      image  = var.api_image
      cpu    = 1.0
      memory = "2Gi"
      env {
        name  = "POSTGRES_URL"
        value = azurerm_postgresql_flexible_server_database.db.connection_string
      }
    }
    min_replicas = 1
    max_replicas = 3
  }

  identity {
    type = "SystemAssigned"
  }

  ingress {
    external_enabled = true
    target_port      = 8080
  }
}

resource "azurerm_container_app" "worker" {
  name                         = "${var.prefix}-worker"
  container_app_environment_id = azurerm_container_app_environment.cae.id
  resource_group_name          = azurerm_resource_group.rg.name

  template {
    container {
      name   = "worker"
      image  = var.worker_image
      cpu    = 0.5
      memory = "1Gi"
    }
    min_replicas = 1
    max_replicas = 2
  }

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_postgresql_flexible_server" "db" {
  name                = "${var.prefix}-pg"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  version             = "16"
  administrator_login          = "certiwatch"
  administrator_password       = var.postgres_password
  storage_mb                   = 32768
  sku_name                     = "GP_Standard_D4s_v3"
  zone                         = "1"
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name      = "certiwatch"
  server_id = azurerm_postgresql_flexible_server.db.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

resource "azurerm_redis_cache" "redis" {
  name                = "${var.prefix}-redis"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.location
  capacity            = 1
  family              = "C"
  sku_name            = "Premium"
}

resource "azurerm_key_vault" "kv" {
  name                = "${var.prefix}-kv"
  location            = var.location
  resource_group_name = azurerm_resource_group.rg.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
}

data "azurerm_client_config" "current" {}
