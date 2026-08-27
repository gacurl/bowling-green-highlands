# Production Deployment Gate

Issue #187 / Issue 8-9: Add CI/CD production deployment gate

## Deployment Path

Production remains:

`pull request -> main -> Vercel production`

This repository does not replace Vercel and does not add a parallel deployment system.
Vercel remains responsible for the production deployment that is created after changes merge to `main`.

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
- there is no live payment behavior
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
