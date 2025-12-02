# CertiWatch

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
- **OCR defaults**: worker runs Tesseract + poppler and can call a docTR sidecar (FastAPI, `apps/ocr-doctr`) for higher-quality OCR. For host-native runs install `tesseract-ocr` and `poppler-utils`; cloud OCR (Azure/GCP/etc.) is optional via env vars.

## Documentation Index

- `docs/setup.md` – local & cloud setup
- `docs/onboarding.md` – Stripe signup + onboarding sequence
- `docs/api.md` – endpoint contracts
- `docs/agent-install.md` – Windows/Linux/macOS service install
- `docs/troubleshooting.md` – common issues

This README serves as the technical high-level. Feature deep dives, operator guides, and future milestones live under `/docs`.

## Docker quickstart

Use Docker to run the stack locally (API on 5002, frontend on 3000, Postgres/Redis, worker inside the network):

```bash
cp .env.docker.example .env    # fill Stripe, email SMTP, worker device IDs if you have them
docker compose up --build
```

If you don’t have device credentials yet, start the API container, then from host run:

```bash
curl -X POST http://localhost:5002/api/devices/enroll \
  -H "Content-Type: application/json" \
  -d '{ "deviceName": "local-worker", "operatingSystem": "docker", "enrollmentCode": "local-dev" }'
```

Copy the returned `deviceId`/`deviceToken` into `.env` (`WORKER__...`) and re-run `docker compose up` to bring the worker online.

Billing in Docker:
- Frontend: http://localhost:3300, API: http://localhost:5002.
- Set Stripe envs in `.env` (`Stripe__SecretKey`, `Stripe__WebhookSecret`, plan price IDs) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Run Stripe CLI locally: `stripe listen --forward-to http://localhost:5002/api/billing/webhook` and use the printed `whsec`.
- You can trigger a session for testing with `stripe trigger checkout.session.completed`.

Auth defaults:
- Magic links are short-lived; the session cookie is long-lived (30 days) when “stay signed in” is checked.
- Links can be sent to a fallback org email; the session is bound to a device identifier cookie (`cw_device`).
- Login flow requires an existing user; unknown emails return a friendly 400 (“We couldn't find that email. Please sign up to start your trial.”). New users join via signup (Stripe) or admin invite.
