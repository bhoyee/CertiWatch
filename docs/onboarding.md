# Signup & Billing Flow

1. Configure Stripe keys (env or `.env`): `Stripe__SecretKey`, `Stripe__WebhookSecret`, plan price IDs, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
2. Deploy API with `/api/billing/checkout` and `/api/billing/webhook` reachable (in Docker: API on `http://localhost:5002`).
3. Frontend in Docker listens on `http://localhost:3300`; success/cancel URLs are set to port 3300.
4. Webhook provisions tenant + first admin; welcome email is sent via SMTP (see SMTP envs).
5. Stripe CLI locally: `stripe listen --forward-to http://localhost:5002/api/billing/webhook` (use the printed `whsec` in env). You can trigger a session with `stripe trigger checkout.session.completed`.

Auth & dashboard (Milestone 2):
- Magic link endpoints: `POST /api/auth/magic-link`, `GET /api/auth/magic-link/verify`, `POST /api/auth/invite`.
- Emails: welcome + magic-link templates in `/emails` are copied into publish output.
- Frontend pages: `/login` (request magic link), `/magic` (verify token, set `cw_session` cookie), dashboard routes gated by middleware expecting `cw_session`.
- Admin invite UI: `/admin/invite` sends invites via `POST /api/auth/invite`.
- Logout route: `/logout` clears the session cookie.
- “Stay signed in” issues a long-lived session (30 days) and binds to a device cookie (`cw_device`). Optional fallback email can receive the same link.

