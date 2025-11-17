# CertiWatch – Silent Auditor

CertiWatch is a SaaS certificate-compliance platform for SMBs. It ingests PDFs/scans via local agents or cloud connectors, extracts staff/course metadata, infers expiries with tenant rules, and keeps admins ahead with reminders/digests.

- **Stack**: .NET 8 modular API + worker, cross-platform agent, Next.js 15 admin UI, PostgreSQL 16 + Redis, Azure Container Apps, Cloudflare WAF/Turnstile.
- **Core flow**: enroll device → watch folders/cloud drives → OCR & parsing → rule engine inference → records dashboard → reminders/digests/export.

## Quickstart

```bash
# bootstrap postgres + redis + hot reload services
scripts/dev.sh

# apply EF Core migrations
scripts/migrate.sh
# optional sample data
# scripts/seed.sh

# run backend tests
dotnet test

# frontend dev server
cd apps/frontend
npm install
npm run dev
```

See `/docs/setup.md` for environment prep, `/docs/api.md` for endpoints, `/docs/agent-install.md` for agent packaging, and `/docs/onboarding.md` for billing/onboarding.

## Milestone 1 – Stripe Signup & Tenant Provisioning

Milestone 1 introduces a real billing flow so customers can self-serve:

1. **Stripe config** – populate the `Stripe` section in `apps/api/appsettings.json` with secret/publishable/webhook keys and price IDs per plan.
2. **Frontend env** – set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (see `apps/frontend/.env.example`).
3. **Signup page** – visit `http://localhost:3000/signup`, choose a plan, enter company/admin info. The UI calls `POST /api/billing/checkout`, receives a Checkout Session URL, and redirects to Stripe.
4. **Webhook** – use Stripe CLI locally: `stripe listen --forward-to http://localhost:5001/api/billing/webhook`. On `checkout.session.completed`, the API provisions a tenant + first admin via `TenantProvisioningService`.
5. **Next steps** – after provisioning, admins receive future magic-link logins (wired up in Milestone 2). Plan metadata is stored on the tenant for enforcement.

## Architecture Overview

- **Billing**: `/api/billing/checkout` creates Checkout Sessions; `/api/billing/webhook` verifies signatures and provisions tenants.
- **Rules & records**: global+tenant rule precedence with automatic reprocessing.
- **Notifications**: weekly digest + configurable expiry reminders (mail templates live in `/emails`).
- **Deploy**: Terraform under `/terraform`, CI/CD in `.github/workflows/ci.yml` (lint, tests, docker build, security scans, terraform plan).

## Documentation Index

- `docs/setup.md` – local & cloud setup
- `docs/onboarding.md` – Stripe signup + onboarding sequence
- `docs/api.md` – endpoint contracts
- `docs/agent-install.md` – Windows/Linux/macOS service install
- `docs/troubleshooting.md` – common issues

This README serves as the technical high-level. Feature deep dives, operator guides, and future milestones live under `/docs`.
