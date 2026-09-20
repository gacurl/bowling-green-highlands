# Production Deployment Gate

Issue #187 / Issue 8-9: Add CI/CD production deployment gate

## Deployment Path

Production remains:

`pull request -> main -> Vercel production`

This repository does not replace Vercel and does not add a parallel deployment system.
Vercel remains responsible for the production deployment that is created after changes merge to `main`.

## Stripe Environment Isolation

Stripe test payment integration exists. Configure each environment as one
matched set; never combine test and live Stripe resources.

| Environment | `NEXT_PUBLIC_APP_URL` | `STRIPE_SECRET_KEY` and `STRIPE_CHECKOUT_PRICE_ID` | Webhook endpoint and `STRIPE_WEBHOOK_SECRET` | Payment policy |
| --- | --- | --- | --- | --- |
| Local Development | Exact local application origin | Matching Stripe test key and test Price | Test endpoint targeting the local `/api/stripe/webhook`; use that endpoint's signing secret | Test only |
| Vercel Preview | Exact Preview origin used for Stripe returns | Matching Stripe test key and test Price in the Preview environment scope | Matching test endpoint targeting the Preview `/api/stripe/webhook`; use that endpoint's signing secret in Preview scope | Test only |
| Vercel Production | Exact production origin | Before approval: unset to disable payment, or a matching test key and test Price for explicitly test-only validation. After approval: matching live key and live Price in Production scope | Before approval: unset when disabled, or the matching test endpoint secret when explicitly test-only. After approval: live endpoint targeting production and that endpoint's signing secret | Live only after explicit go-live approval |

Operational rules:

- The secret key, Price ID, webhook endpoint and secret, and application URL
  must all belong to the environment being exercised.
- Test and live Stripe resources must never be mixed.
- Every webhook signing secret belongs to one specific Stripe endpoint and
  environment. Do not reuse it for another endpoint or environment.
- Keep Stripe secret keys and webhook secrets server-side. Never use a
  `NEXT_PUBLIC_` variable for either secret.
- Before explicit go-live approval, Production payment must remain disabled or
  be clearly operated as test-only with a complete matching test resource set.
- After approval, replace the complete Production test set with a complete live
  set; do not replace individual values piecemeal.

The local placeholder format and variable names are documented in
[`.env.example`](../.env.example). The concise setup summary is in the
[README](../README.md#stripe-environment-isolation).

## Required Pull Request Checks

Before merging to `main`, branch protection requires passing checks for:

- `build`
  - installs dependencies with `npm ci`
  - runs `npm test`
  - runs `npm run build`
  - runs `npm run lint --if-present`
- `Analyze (javascript-typescript)`
  - runs JavaScript/TypeScript CodeQL analysis
- `dependency-review`
  - reviews dependency changes on pull requests to `main`
- `Trivy Security`
  - scans the repository filesystem and Node dependency surface with Trivy
  - fails on `MEDIUM`, `HIGH`, and `CRITICAL`
  - does not fail solely on `LOW`
- `Vercel`
  - confirms the Vercel deployment check passed

## Branch Protection Enforcement

The `main` branch is protected by GitHub branch protection:

- strict branch synchronization: ON
- administrator enforcement: ON
- force pushes: BLOCKED
- branch deletion: BLOCKED

## Merge and Production Deployment

After all required pull request checks pass, merge the pull request to `main`.
The existing Vercel integration should then create the production deployment from `main`.

Do not treat the GitHub workflow as the production host.
Do not add Docker, Kubernetes, or custom deployment infrastructure for this gate.

## Post-Deployment Smoke Validation

After Vercel reports a successful production deployment, run the production smoke validation tracked under Issue #111.
The smoke validation must preserve the current product truth:

- reservation requests are not bookings
- Stripe payment never confirms a reservation
- Production payment remains disabled or test-only until explicit go-live approval
- any approved live payment smoke uses only the complete matching Production Stripe set
- there is no automatic confirmation
- there is no automatic availability locking
- availability remains day-level and operator-controlled
- blocked or unconfigured dates cannot be requested
- the public flow remains `landing -> reserve -> confirmation`

## When CI or Security Checks Fail

Do not merge while a required CI or security check is failing.

For CI failures, inspect the failing command and make the smallest issue-scoped fix.
For CodeQL, Dependency Review, or Trivy failures, inspect the finding and decide whether it can be fixed safely within the active issue.
Do not force dependency upgrades, suppress findings, or broaden application behavior to make the check pass.
If a security finding requires dependency, persistence, auth, payment, or infrastructure changes outside the active issue, open or use a separate issue.

## When Vercel Deployment Fails

If the Vercel production deployment from `main` fails, do not build a parallel deployment path from GitHub Actions.
Use the Vercel deployment logs to identify the failing build or runtime configuration and fix the smallest repository or Vercel setting needed.
If the failure involves production data protection, backup, or restore planning, reference Issue #110 for backup and recovery instead of duplicating recovery procedures here.
