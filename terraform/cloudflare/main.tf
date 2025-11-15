terraform {
  required_version = ">= 1.8.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.40.0"
    }
  }
}

provider "cloudflare" {}

variable "zone_id" {
  type = string
}

variable "api_hostname" {
  type = string
}

variable "frontend_hostname" {
  type = string
}

resource "cloudflare_record" "api" {
  zone_id = var.zone_id
  name    = "api"
  value   = var.api_hostname
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_record" "frontend" {
  zone_id = var.zone_id
  name    = "app"
  value   = var.frontend_hostname
  type    = "CNAME"
  proxied = true
}

resource "cloudflare_turnstile_widget" "forms" {
  account_id = data.cloudflare_accounts.me.accounts[0].id
  name       = "certiwatch-turnstile"
  domain     = "${var.frontend_hostname}"
  mode       = "managed"
}

data "cloudflare_accounts" "me" {}
