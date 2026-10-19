# Production Architecture Decision

**Issue:** #268 / Issue 8-8c

**Decision date:** 2026-10-19

**Decision status:** Approved target architecture; implementation and
production-readiness validation remain incomplete.

## Purpose and scope

This document selects the production hosting and durable-storage architecture
for Bowling Green Highlands. It records the approved responsibilities,
rationale, operating limits, and implementation dependencies.

This issue does not provision resources, configure services, migrate data, or
change production. It contains no secrets, credentials, or customer
information.

## Verified hosting evidence

The architecture decision builds on two completed evidence reviews:

- [Bluehost Account and DNS Capabilities](bluehost-capabilities.md) verifies
  that Bluehost manages authoritative DNS and that the apex and `www` records
  route to the Vercel-hosted application.
- [Vercel Production Configuration Capabilities](vercel-production-capabilities.md)
  verifies that Vercel hosts the Next.js application, tracks `main` for
  Production, and serves the configured Production domains.

The Vercel review also establishes that application environment configuration,
environment isolation, and durable persistence are not production-ready.

## Architecture decision

The approved production architecture is:

```text
Bluehost authoritative DNS
    -> Vercel Next.js application
        -> new dedicated Bowling Green Highlands Neon PostgreSQL Free project
```

Responsibilities are assigned as follows:

| Component | Responsibility |
| --- | --- |
| Bluehost | Authoritative DNS and management of the existing DNS zone |
| Vercel | Next.js build, deployment, application runtime, domains, and HTTPS |
| New dedicated BGH Neon project | Durable PostgreSQL storage for all application-owned operational data |

The additional recurring database budget approved by this decision is
**$0 per month**. No paid service may be activated without prior client
approval.

The existing Neon project named `neon-apricot-castle` belongs to another
application. It must never be connected to, queried by, modified for, migrated
into, or otherwise reused by Bowling Green Highlands.

## Rationale

A new dedicated managed PostgreSQL project is the smallest reliable fit for the
verified architecture because it:

- retains Bluehost and Vercel in their existing verified roles;
- removes production reliance on Vercel runtime files;
- provides transactional storage for concurrent application requests;
- supports database constraints and controlled state transitions;
- keeps database server maintenance outside the application operator's normal
  responsibilities;
- isolates Bowling Green Highlands from unrelated applications; and
- allows the existing user-visible behavior to remain unchanged while the
  persistence implementation is replaced under Issue #261.

## Data mapping

Issue #261 must replace the four JSON-backed categories with PostgreSQL-backed
storage without changing their application semantics:

| Current data category | PostgreSQL responsibility | Required preservation |
| --- | --- | --- |
| Owner credentials and session material | Durable server-only credential records | Preserve password-hash and session-generation behavior; never store plaintext passwords. Missing, malformed, or unavailable credential state must continue to fail according to existing rules. |
| Operator availability | Date-keyed availability records | Preserve operator control, day-level availability, and unavailable-by-default behavior. |
| Reservation requests and payment state | Durable request records and their status/payment state | Preserve identifiers, timestamps, request data, existing state-transition rules, and trusted payment handling. A request or payment must never become booking confirmation or silently alter availability. |
| Homepage content | Durable structured content records | Preserve current content validation, defaults, and operator editing behavior. |

The database migration must not reinterpret existing values, create bookings,
change availability, weaken Admin access, or broaden payment behavior.

## Production and Preview isolation

The new Neon project must be dedicated exclusively to Bowling Green Highlands.
Within that project:

- Production and Preview must use separate Neon branches or databases;
- Production and Preview must use separate database roles and connection
  strings;
- Vercel must scope each connection string only to its matching environment;
- Preview must have no credentials capable of accessing Production data;
- Preview must use synthetic or explicitly sanitized data, not customer data;
- schema changes must be validated outside Production before promotion; and
- Free-plan consumption monitoring must account for the entire project,
  including Preview usage.

The exact branch/database layout, roles, migration workflow, and connection
pooling configuration belong to Issue #261. Environment-variable configuration
and email configuration belong to Issue #262.

## Neon Free limits and operating thresholds

The following Neon Free limits were verified on October 2, 2026 from
[Neon's Free plan announcement](https://neon.com/blog/neon-free-plan-1-gb-per-project):

| Resource | Verified Free limit | Internal warning threshold |
| --- | --- | --- |
| Database storage | 1 GB per project | 0.8 GB, or 80% |
| Compute | 100 CU-hours per project per month | 80 CU-hours per month, or 80% |
| Instant restore | 6-hour restore window | No lower internal threshold; recovery adequacy must be evaluated separately |

The 80% values are internal operating thresholds, not Neon service limits or
automatic upgrade points.

The following policy applies:

- forecast storage above 1 GB or compute above 100 CU-hours per month requires
  a client decision before the limit is reached;
- inadequate recovery, performance, or availability may trigger a paid-plan
  evaluation even when usage remains below the warning thresholds;
- warning-threshold monitoring must cover Production and Preview consumption;
- the system must never automatically upgrade a plan or incur charges; and
- explicit client approval is required before any paid service is activated.

Current and future Neon limits and pricing must be reverified before
implementation and before any paid-plan decision.

## Backup and recovery requirements

The Neon 6-hour instant-restore window is not, by itself, sufficient recovery
evidence. Production requires an independent backup and a tested restoration
path.

Issue #110 must define:

- an independent backup destination and method;
- backup frequency and retention;
- encryption and access controls;
- recovery point and recovery time objectives;
- failure reporting and ownership;
- a restoration procedure into an isolated non-Production target; and
- recorded evidence from a successful restoration test.

Whether independent backups and restoration testing can be operated at
**$0 per month is UNVERIFIED**. If adequate recovery requires a paid Neon plan
or another paid service, the client must approve the cost before activation.

The application must not be declared production-ready until backup and recovery
requirements are approved and a restoration path has been validated.

## Implementation dependencies

### Issue #261 — durable persistence

Issue #261 owns:

- provisioning the new BGH-only Neon project after authorization;
- schema design and database invariants;
- Production and Preview database isolation;
- concurrency-safe application persistence;
- migration preflight, import, verification, cutover, and rollback;
- connection management suitable for the Vercel runtime;
- preservation of credential, availability, reservation, payment, and content
  semantics; and
- regression and durability validation.

### Issue #110 — backup and recovery

Issue #110 owns independent backup selection, retention, recovery objectives,
the restore runbook, and restoration testing.

### Issue #262 — environment and email configuration

Issue #262 owns Vercel Production/Preview environment-variable isolation,
database connection-secret configuration, email configuration, and related
secret handling. Secret values must never be committed or documented.

## Risks

- Free storage or compute limits may be insufficient as usage grows.
- A 6-hour instant-restore window may not satisfy the approved recovery
  objectives.
- Zero-cost independent backup feasibility is unverified.
- Missing or ineffective usage monitoring could allow service interruption at
  a Free-plan limit.
- Incorrect Vercel environment scoping could expose Production data to Preview.
- Incorrect migration or cutover could lose or reinterpret existing JSON data.
- Inadequate connection management could cause failures under Vercel runtime
  concurrency.
- Provider availability or performance may require a paid-plan evaluation.
- Production application secrets and email configuration remain incomplete
  until Issue #262 is resolved.

## Explicit exclusions

This decision does not authorize:

- connecting to or changing `neon-apricot-castle`;
- provisioning a Neon project or database;
- changing Bluehost DNS;
- changing Vercel project or deployment settings;
- adding or revealing environment-variable values;
- migrating or deleting JSON data;
- changing reservation, availability, Admin, payment, or content behavior;
- activating a paid plan or incurring recurring charges;
- declaring the application production-ready; or
- staging, committing, pushing, or creating a pull request.

## Approval boundary

The target architecture is approved for documentation:

`Bluehost DNS -> Vercel application -> new dedicated BGH Neon PostgreSQL Free project`

Implementation remains blocked on Issues #261, #110, and #262. Production
readiness remains blocked until environment isolation, durable migration,
independent backup, and a tested restoration path are complete.
