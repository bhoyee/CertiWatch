# Setup

## Prerequisites
- .NET 8 SDK
- Node 22+
- Docker + Docker Compose
- PostgreSQL 16 & Redis (or run `infra/docker-compose.dev.yml`)

## Local Steps
1. `scripts/dev.sh` to start Postgres/Redis and watch API/worker/agent/frontend.
2. In another terminal, `scripts/migrate.sh` and `scripts/seed.sh`.
3. Navigate to `http://localhost:3000` and sign in with the seeded tenant (`admin@acmecare.test`).

## Environments
- `apps/api/.env.example` defines secrets for API & workers.
- Terraform under `/terraform` provisions Azure Container Apps + PostgreSQL Flexible Server, Redis, Key Vault, and Cloudflare DNS/Turnstile.

Deploy flow:
```bash
az login
cd terraform/azure
terraform init
terraform apply -var prefix=certiwatch -var api_image=... -var worker_image=...
```

Set Key Vault + Vercel env via `/scripts` helpers or Azure CLI, then push Docker images via GitHub Actions (see `.github/workflows/ci.yml`).
