# Signup & Billing Flow

1. Configure Stripe keys in `apps/api/appsettings.json`.
2. Deploy API with `/api/billing/checkout` and `/api/billing/webhook` reachable.
3. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in the frontend and visit `/signup` to choose a plan.
4. Stripe webhook events provision tenants via the new TenantProvisioningService.
5. Use Stripe CLI locally: `stripe listen --forward-to http://localhost:5001/api/billing/webhook`.

