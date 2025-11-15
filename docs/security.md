# Security

- **RLS everywhere**: `tenant_id` is enforced on every query and mirrored in EF models.
- **Secrets**: stored in Azure Key Vault, injected into Container Apps through managed identity.
- **Transport**: TLS-only, HSTS headers enforced via middleware, Cloudflare WAF in front of public endpoints.
- **Auth**: admin UI uses cookie sessions + Turnstile, staff approvals use short-lived magic links signed with HMAC.
- **Devices**: Local agents enroll with one-time codes, tokens stored in OS keychain; heartbeat required to keep agent active.
- **PII minimization**: only file path + hash stored, binary copies only when tenant opts into R2 archival.
- **Rate limits**: Redis-backed counters for devices + tenants; low-trust agent actions gated server-side.
