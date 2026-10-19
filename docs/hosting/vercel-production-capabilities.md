# Vercel Production Configuration Capabilities

**Issue:** #267 / Issue 8-8b

**Verification date:** 2026-10-19

**Repository:** `gacurl/bowling-green-highlands`

**Application baseline:** `v1.4.2`

## Purpose and scope

This document records evidence collected from the repository, the Vercel
dashboard, and the DNS and HTTPS verification completed under Issue #266. It
verifies the observed Vercel production configuration without changing or
approving that configuration.

The established responsibility boundaries are:

- Bluehost manages authoritative DNS.
- Vercel hosts the Next.js application.
- Environment and email configuration belongs to Issue #262.
- Durable persistence implementation belongs to Issue #261.
- Final architecture selection belongs to Issue #268.

This document contains no secret values or credentials. A Vercel deployment
reported as ready is not evidence that the application is production-ready.

## Evidence status definitions

| Status | Meaning |
| --- | --- |
| Verified | Confirmed from repository state, the Vercel dashboard, or Issue #266 evidence. |
| Unverified | The relevant setting or behavior was not confirmed by the collected evidence. |
| Blocked | Production readiness depends on work owned by another issue. |

## Application and hosting baseline

| Finding | Status | Evidence source |
| --- | --- | --- |
| Application baseline is `v1.4.2` | Verified | Repository |
| Application uses Next.js `16.3.8` | Verified | Repository |
| Vercel runtime is configured for Node.js `24.x` | Verified | Vercel dashboard |
| No `vercel.json` is present | Verified | Repository |
| Bluehost manages authoritative DNS | Verified | Issue #266 |
| Vercel hosts the application | Verified | Vercel dashboard and Issue #266 HTTPS evidence |

The repository does not define account-specific Vercel settings. Dashboard
observations are therefore recorded separately from repository configuration.

## Git integration

| Setting | Verified value | Status |
| --- | --- | --- |
| Connected repository | `gacurl/bowling-green-highlands` | Verified |
| Production Branch | `main` | Verified |
| Preview branches | Unassigned branches | Verified |

Production deployments track `main`. Branches not assigned to Production are
eligible for Preview deployments under the observed configuration.

## Build configuration

| Setting | Verified value | Status |
| --- | --- | --- |
| Framework preset | Next.js | Verified |
| Build Command override | Disabled | Verified |
| Install Command override | Disabled | Verified |
| Output Directory override | Disabled | Verified |
| Development Command override | Disabled | Verified |
| Root Directory | `./` | Verified |
| Include files outside the root directory | Enabled | Verified |
| Skip unchanged deployments | Enabled | Verified |

Disabled command overrides mean no account-specific command override was
observed. They do not independently prove the exact command executed by every
deployment.

## Current Production deployment

| Finding | Verified value | Status |
| --- | --- | --- |
| Deployment status | Ready, Current | Verified |
| Source branch | `main` | Verified |
| Source commit | `707bd02` | Verified |
| Associated change | Merge PR #269 for Issue #266 | Verified |
| Build duration | 20 seconds | Verified |
| Build warnings | 3 | Verified count; warning contents unverified |

The deployment status confirms that Vercel completed and currently serves this
deployment. The three build warnings were not inspected, so their relevance and
risk remain unknown.

## Domains and HTTPS

| Domain | Vercel assignment | Configuration status |
| --- | --- | --- |
| `bowlinggreenhighlands.com` | Production | Valid Configuration |
| `www.bowlinggreenhighlands.com` | Production | Valid Configuration |
| `bowling-green-highlands.vercel.app` | Production | Valid Configuration |

Issue #266 separately verified valid HTTPS responses for the apex and `www`
hostnames. Both returned the Vercel-hosted Next.js application, HTTPS
certificate validation succeeded, and no redirect was observed.

This issue does not select a canonical hostname or change domain, redirect,
certificate, or DNS configuration.

## Environment configuration

| Finding | Status |
| --- | --- |
| Project environment variables | None configured — Verified |
| Shared environment variables | None configured — Verified |
| Vercel system environment variables | Enabled — Verified |
| Application-secret isolation between Production and Preview | Not configured — Verified gap |
| Production email configuration | Unverified and not production-ready |
| Production Admin secrets | Unverified and not production-ready |
| Production Stripe configuration | Unverified and not production-ready |

System environment variables do not replace the application-specific values
required for email, Admin access, or Stripe. With no Project or Shared
environment variables configured, the collected evidence does not establish a
usable or isolated Production application-secret configuration.

Environment and email configuration must be addressed under Issue #262. No
variable values should be added to this document.

## Storage and durable persistence

| Finding | Status |
| --- | --- |
| Dedicated Bowling Green Highlands database | Not identified |
| `neon-apricot-castle` | Verified as belonging to another application |
| Reuse of `neon-apricot-castle` for this application | Prohibited |
| Current JSON persistence | Not production-durable |
| Durable persistence implementation | Blocked by Issue #261 |
| Final architecture selection | Blocked by Issue #268 |

The `neon-apricot-castle` database must not be connected to or reused by Bowling
Green Highlands. No other storage integration was verified as dedicated to this
application.

The current JSON-backed owner credentials, availability, reservation requests,
and editable website content have no established durable production storage on
Vercel. This issue does not implement or select a persistence service.

## Runtime limitations

| Runtime capability | Status |
| --- | --- |
| Node.js `24.x` | Verified |
| Function region | Unverified |
| Function duration | Unverified |
| Fluid Compute configuration | Unverified |
| Durable filesystem guarantee | Not established |

No collected evidence establishes that Vercel runtime files survive function
replacement, scaling, rebuilds, or redeployments. Local JSON files must not be
treated as durable Production storage. Resolution belongs to Issue #261.

## Outstanding production-readiness gaps

The following gaps prevent this evidence from being interpreted as production
readiness or architecture approval:

- three build warnings have not been inspected;
- no Project or Shared application environment variables are configured;
- Production and Preview application secrets are not isolated;
- Production email configuration is unverified;
- Production Admin secrets are unverified;
- Production Stripe configuration is unverified;
- no dedicated Bowling Green Highlands database or other durable store was
  identified;
- current JSON persistence is not production-durable;
- function region, duration, and Fluid Compute configuration are unverified;
  and
- no durable filesystem guarantee has been established.

Issue #262 owns environment and email configuration. Issue #261 owns durable
persistence implementation. Issue #268 owns final architecture selection.

## Verified conclusion

The evidence confirms that Vercel is connected to the expected GitHub
repository, tracks `main` for Production, recognizes the Next.js application,
uses Node.js `24.x`, and currently serves a Ready deployment through three valid
Production domains.

The evidence does not establish application-secret configuration, environment
isolation, durable persistence, or complete runtime settings. It therefore does
not establish production readiness and does not approve the final architecture.
No production configuration was changed during this verification.
