# Bowling Green Highlands

Bowling Green Highlands is a reservation request system for a working farm.
It gives guests a simple way to send a reservation request and gives the farm
operator a defined email destination for reviewing those requests.

This project is for:
- guests who want to request a stay or event date
- farm operators who need a lightweight way to receive and review requests

This is a request system, not a booking platform. A submitted request is not a
confirmed booking.

## Current State

Right now the application supports a simple public flow:

`landing -> reserve -> confirmation`

Milestone 2 status: complete.

What it does today:
- guests can open the public landing page
- guests can submit a reservation request from `/reserve`
- the app forwards the request server-side to `CONTACT_EMAIL`
- the confirmation page explains that the request was submitted for review
- the confirmation page makes clear that no booking has been confirmed
- operators can manage day-level availability from `/admin`
- public request options are filtered by operator availability
- accepted requests can use the Stripe test payment integration
- signed Stripe webhooks establish trusted paid status without confirming a booking

## MVP Scope

Current MVP scope:
- request-based reservation flow
- server-side email forwarding for submitted requests
- basic server-side validation for required request fields
- operator day-level availability controls
- test-mode Stripe Checkout for accepted requests

What this does not do yet:
- no confirmed booking flow
- no live Stripe payments before explicit go-live approval
- no submission list or admin dashboard
- no public account system

## Durable Persistence

Owner credentials, operator availability, reservation/payment state, and
homepage content are stored in PostgreSQL. Local development and Vercel Preview
use the server-only pooled Neon connection in `DATABASE_URL`. Vercel Production
uses only the restricted runtime-role connection in
`BGH_RUNTIME_DATABASE_URL`; a missing or blank Production credential fails
closed and never falls back to `DATABASE_URL`. Keep the Neon-managed
`DATABASE_URL` untouched. Production and Preview use isolated Neon branches and
roles.

Scope `BGH_RUNTIME_DATABASE_URL` only to Vercel Production. Adding or changing
it and creating the deployment require separate approval. Redeploy after the
approved environment change because existing deployments do not receive new
environment-variable values.

Database migrations never run during application startup, build, or deployment.
Run them explicitly with a direct connection owned by the separately authorized
migration role:

```bash
MIGRATION_DATABASE_URL='<migration-connection-string>' npm run db:migrate -- \
  --target preview \
  --runtime-role bgh_preview_app
```

Production additionally requires `--confirm-production`. The migration command
requires target-specific `BGH_PREVIEW_NEON_PROJECT_ID` and
`BGH_PREVIEW_NEON_BRANCH_ID` values (or their `BGH_PRODUCTION_*` equivalents).
Before provisioning migration identity, use the authenticated Neon Console to
select the intended branch and independently verify its project, branch, and
compute endpoint IDs. Then, as that target's migration role, provision the
identity table manually:

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS public.bgh_migration_identity (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  migration_target TEXT NOT NULL CHECK (
    migration_target IN ('preview', 'production')
  ),
  neon_project_id TEXT NOT NULL,
  neon_branch_id TEXT NOT NULL
);
REVOKE ALL PRIVILEGES ON public.bgh_migration_identity
  FROM PUBLIC, bgh_preview_app;
INSERT INTO public.bgh_migration_identity (
  singleton, migration_target, neon_project_id, neon_branch_id
) VALUES (TRUE, 'preview', '<project-id>', '<branch-id>')
ON CONFLICT (singleton) DO UPDATE SET
  migration_target = EXCLUDED.migration_target,
  neon_project_id = EXCLUDED.neon_project_id,
  neon_branch_id = EXCLUDED.neon_branch_id;
COMMIT;
```

The runner only reads this table; it never creates, modifies, or repairs it. It
requires one valid row, ownership by the authenticated migration role, and no
effective runtime access before any migration write. Provision Production with
its own verified values and a `production` target. Reverify and reprovision after
cloning or resetting a branch. These values remain operator attestations, not
Neon control-plane proof; a privileged administrator can change them.

Preview requires the runtime role `bgh_preview_app`. For both targets, the
migration role must be distinct from the runtime role. The runtime role must not
be able to assume the migration role, have elevated role attributes, or have
database/schema `CREATE`. The command preserves the least-privilege table and
sequence grants required by the application stores.

## Planned Direction

Near-term direction (Milestone 3):
- keep reservation flow request-based
- preserve operator-controlled day-level availability truth
- expand public availability presentation beyond the current fixed example-day context
- keep the operator workflow simple and low-cognitive-load

Out of scope for Milestone 3:
- subscription billing, automated collections, or payment recovery workflows
- auto-booking
- recurring scheduling
- drag/drop calendars
- booking-platform behavior

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env.local
```

3. Update `.env.local` with local values.

4. Start the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Environment Variables

Local setup values belong in `.env.local`. Vercel-only values are identified
separately below:

- `NEXT_PUBLIC_APP_URL`
  Public base URL for local development and future links.
  Example: `http://127.0.0.1:3000`
- `CONTACT_EMAIL`
  Operator email address that receives reservation requests.
  Example: `hello@example.com`
- `SMTP_URL`
  SMTP connection string used for server-side email forwarding.
  Example: `smtp://localhost:1025`
- `EMAIL_FROM`
  Sender identity used when the app forwards reservation requests.
  Example: `reservations@example.com`
- `ADMIN_PASSWORD`
  Bootstrap and owner-authorized break-glass credential. After owner credential
  initialization it is not accepted during normal operation.
  Example: `change-this-admin-password`
  For owner-authorized break-glass recovery only, see the
  [Admin password recovery guide](docs/admin-password-recovery.md). Authenticated
  owners change their normal password from the private Admin area.
- `BGH_ADMIN_RECOVERY_MODE`
  Keep `disabled` for normal operation. Set to `enabled` only during an
  owner-authorized break-glass recovery window.
- `BGH_ADMIN_BOOTSTRAP_MODE`
  Set to `enabled` only for first-time owner password setup, then disable or
  remove it after initialization.
- `DATABASE_URL`
  Server-only pooled Neon connection used by local development and Vercel
  Preview. Keep the Neon integration-managed Production value untouched; the
  application does not use it as a Production fallback.
- `BGH_RUNTIME_DATABASE_URL`
  Server-only pooled connection for the restricted Production runtime role.
  Configure it only in the Vercel Production scope after separate approval,
  then redeploy. Do not configure it for Preview or local development.
- `STRIPE_SECRET_KEY`
  Server-only Stripe test secret key for local development.
- `STRIPE_CHECKOUT_PRICE_ID`
  Stripe test Price ID that matches the configured test secret key.
- `STRIPE_WEBHOOK_SECRET`
  Signing secret for the test webhook endpoint targeting this environment.

See [.env.example](.env.example)
for the current starter values.

## Admin Credential Storage

Before the owner credential is initialized, `ADMIN_PASSWORD` provides the
bootstrap login only while `BGH_ADMIN_BOOTSTRAP_MODE` is explicitly set to
`enabled`. Bootstrap login goes directly to the private first-time password
setup page. With bootstrap mode disabled, missing credential state fails
closed.

After initialization, normal Admin login uses only the stored owner password
hash. Bootstrap mode is ignored even if it remains temporarily enabled, and
`ADMIN_PASSWORD` remains rejected unless recovery mode is explicitly enabled.

The owner credential is stored in PostgreSQL as a salted scrypt hash and
session-generation material, never the plaintext password. Missing state
permits bootstrap only during explicit bootstrap mode; malformed or unreadable
state always fails closed and is not overwritten. Disable or remove bootstrap
mode after successful initialization.

Authenticated owners can use **Change password** from the private Admin area.
The action verifies the current owner password, rotates the stored credential
and session state, clears the current session, and requires a new sign-in.
Recovery-mode sessions cannot use the normal owner password-change action.

## Stripe Environment Isolation

Stripe payment integration exists in test mode. Local Development and Vercel
Preview must use matching Stripe test resources. Vercel Production remains
payment-disabled or explicitly test-only until go-live is approved; only then
may it use a matching set of live Stripe resources.

Never mix test and live keys, Prices, webhook endpoints, or webhook secrets.
`NEXT_PUBLIC_APP_URL` must also match the environment receiving Stripe returns.
See the canonical
[Stripe environment matrix](docs/production-deployment-gate.md#stripe-environment-isolation)
before configuring any deployment.
For planned or emergency credential changes, follow the
[Stripe credential rotation runbook](docs/stripe-credential-rotation.md).

## Routes

- `/`
  Landing page for the public reservation request flow.
- `/reserve`
  Single-step reservation request form.
- `/confirmation`
  Confirmation page that explains the request was submitted for operator review.
- `/admin`
  Operator day-level availability calendar (requires admin login).
- `/admin/login`
  Admin login screen used to establish the operator session.

## Development Notes

- The app uses Next.js App Router with TypeScript, ESLint, and Tailwind CSS.
- Reservation requests are forwarded by the app on the server using SMTP.
- If validation fails or email delivery fails, the user is returned to
  `/reserve?error=1` with a plain recovery message.

## Application Versioning

`package.json` is the authoritative application version source. Versions follow
Semantic Versioning:

- `PATCH`: backward-compatible fix
- `MINOR`: backward-compatible feature
- `MAJOR`: intentional incompatible product or system change

Release tags use `vX.Y.Z` and are created from the intended release commit on
`main`, not from an issue branch.

Production behavior changes include the appropriate Semantic Version bump in the
same issue before merge.
