# CertiWatch – Silent Auditor

CertiWatch is a certificate compliance service for SMB admins. It ingests certificates from local folders or optional cloud connectors, extracts course metadata, infers missing expiry dates, and automates digest/reminder workflows.

- **Tech**: .NET 8 modular monolith (Minimal APIs + workers + agent), Next.js 15 admin, PostgreSQL 16, Redis queues, Azure Container Apps, Cloudflare edge.
- **Mission-critical flows**: device enrollment + folder monitoring, OCR/Parsing, rule engine with tenant overrides, reminder pipeline with weekly digests + one-click magic links.

## Quickstart

```bash
# bootstrap dev infra
scripts/dev.sh

# run migrations + seed
scripts/migrate.sh
scripts/seed.sh

# run tests (unit + contract)
dotnet test
```

See `/docs/setup.md` for full instructions, `/docs/api.md` for endpoint contracts, and `/docs/agent-install.md` for Windows/Linux/macOS agent service notes.
# CertiWatch
