output "resource_group" {
  value = azurerm_resource_group.rg.name
}

output "api_hostname" {
  value = azurerm_container_app.api.latest_revision_fqdn
}

output "worker_hostname" {
  value = azurerm_container_app.worker.latest_revision_fqdn
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.db.fqdn
}

output "redis_hostname" {
  value = azurerm_redis_cache.redis.hostname
}

output "key_vault_uri" {
  value = azurerm_key_vault.kv.vault_uri
}
