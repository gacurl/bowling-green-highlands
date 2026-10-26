# Production DNS Rollback Procedure

**Issue:** #289 / Issue 8-24a

**Procedure status:** Documented recovery; not tested.

## Purpose and scope

This procedure documents the smallest recovery required to restore the approved
public DNS path for `bowlinggreenhighlands.com`:

```text
Bluehost authoritative DNS -> Vercel application
```

It is a recovery runbook, not authorization to change production. Before using
it, an operator must confirm that the targets in this document are still the
current approved targets and that the recovery is authorized.

This procedure changes no application, Vercel, persistence, mail, or secret
configuration. It must not be used to reset the DNS zone, delete records in
bulk, or redesign the production architecture.

The underlying Bluehost and DNS evidence is recorded in
[Bluehost Account and DNS Capabilities](bluehost-capabilities.md). The approved
hosting responsibilities are recorded in
[Production Architecture Decision](production-architecture-decision.md).

## Recovery status

| Status | Meaning |
| --- | --- |
| Documented recovery | The approved values, restoration steps, safeguards, and verification checks are recorded here. |
| Tested recovery | An authorized recovery or controlled recovery exercise has completed every verification check and retained the resulting evidence. |

This issue establishes only **documented recovery**. No DNS rollback or recovery
exercise has been performed, so recovery remains **not tested**.

## Known-good DNS configuration

The following values are the approved recovery baseline. They must be verified
as current before any future recovery because provider targets can change.

| Purpose | Name | Type | Approved value |
| --- | --- | --- | --- |
| Domain | `bowlinggreenhighlands.com` | — | `bowlinggreenhighlands.com` |
| Apex application record | `bowlinggreenhighlands.com` | A | `216.198.79.1` |
| `www` application record | `www.bowlinggreenhighlands.com` | CNAME | `05595c7797e7e96e.vercel-dns-017.com` |
| Authoritative nameserver | `bowlinggreenhighlands.com` | NS | `ns1.bluehost.com` |
| Authoritative nameserver | `bowlinggreenhighlands.com` | NS | `ns2.bluehost.com` |
| Application host | — | — | Vercel |

These are the application-routing and delegation values. They are not a
complete inventory of the DNS zone.

## Pre-restoration checks

Before editing any record:

1. Confirm that the recovery is authorized and that the selected Bluehost
   account and domain are for `bowlinggreenhighlands.com`.
2. Reconfirm that the apex, `www`, nameserver, and application-host values above
   are still the current approved targets. Stop if they cannot be confirmed.
3. Record the current public nameservers and the current apex and `www` record
   values before making changes.
4. Review the current Bluehost zone and record the existing values for the
   records that would be edited. Use available read-only views; this procedure
   does not assume that a zone-export feature exists.
5. Confirm that existing MX, SPF, DKIM, DMARC, TXT, CAA, verification, and other
   unrelated records are present and will remain unchanged.
6. Preserve each existing TTL value where practical. Do not invent a new TTL to
   accelerate recovery.

### Stop conditions

Stop without changing DNS if:

- the domain, recovery authorization, or current approved targets cannot be
  confirmed;
- an unexpected A, AAAA, or CNAME record conflicts with the apex or `www`
  recovery values;
- the authoritative nameservers or DNSSEC state are unexpected;
- a required action would alter or remove an unrelated DNS record;
- the existing zone cannot be recorded well enough to identify the intended
  record-level changes; or
- the Bluehost controls do not clearly correspond to the domain and records in
  this procedure.

Resolve the discrepancy before continuing. Do not use a zone reset, bulk
deletion, DNSSEC change, or speculative record deletion as a workaround.

## Minimal Bluehost Zone Editor restoration

Use Bluehost Zone Editor only after the pre-restoration checks pass:

1. Open Zone Editor for `bowlinggreenhighlands.com` and verify the domain again
   before selecting a record.
2. Locate the apex A record represented by the root domain. If it is present
   with the wrong value, change only its target to `216.198.79.1`. If it is
   absent and there is no conflicting record, create the single required apex A
   record.
3. Locate the CNAME for `www.bowlinggreenhighlands.com`. If it is present with
   the wrong value, change only its target to
   `05595c7797e7e96e.vercel-dns-017.com`. If it is absent and there is no
   conflicting record, create the required `www` CNAME.
4. Preserve the existing TTL for each edited record where practical and submit
   each record-level change individually.
5. Re-read the apex and `www` records in Zone Editor and compare them with the
   approved values before leaving the zone.

Do not delete or replace the zone. Do not modify MX, SPF, DKIM, DMARC, TXT, CAA,
verification, mail-host, subdomain, or other unrelated records. If any
unexpected record appears to prevent the restoration, stop and investigate the
conflict instead of deleting it.

## Nameserver and delegation verification

Nameserver delegation is separate from editing application records in Zone
Editor:

1. Verify that public NS lookups return both `ns1.bluehost.com` and
   `ns2.bluehost.com`.
2. If both approved nameservers are already authoritative, do not change
   delegation.
3. If public delegation differs, do not add or edit ordinary NS records in Zone
   Editor as a substitute for restoring delegation. Reconfirm the approved
   nameservers, identify the domain's authoritative nameserver control, and
   verify the current DNSSEC state before an authorized delegation change.
4. Stop if the delegation is managed outside the expected account, the required
   control is unclear, or DNSSEC conditions are unexpected. Do not disable
   DNSSEC as part of this procedure.
5. After any separately authorized delegation restoration, verify that the
   authoritative Bluehost zone contains the approved apex and `www` records and
   still contains all unrelated records.

This procedure intentionally does not name controls that were not verified in
the Bluehost interface.

## Verification

Complete all three verification layers. Do not declare recovery successful from
the Zone Editor display alone.

### DNS

Verify the public results without relying on a propagation estimate:

```sh
dig +short NS bowlinggreenhighlands.com
dig +short A bowlinggreenhighlands.com
dig +short CNAME www.bowlinggreenhighlands.com
```

The results must match the approved nameservers, apex A target, and `www` CNAME
target. If public results do not match, retain the observed output and continue
investigation; do not make additional speculative changes.

Where an authoritative-server comparison is needed, query the approved
Bluehost nameserver directly:

```sh
dig @ns1.bluehost.com +short A bowlinggreenhighlands.com
dig @ns1.bluehost.com +short CNAME www.bowlinggreenhighlands.com
```

### HTTPS

Verify both public hostnames with normal certificate validation enabled:

```sh
curl -ILsS https://bowlinggreenhighlands.com
curl -ILsS https://www.bowlinggreenhighlands.com
```

For both hostnames, confirm that TLS certificate validation succeeds and that
the final response is the expected Vercel-hosted application rather than a DNS,
certificate, provider-placeholder, or application error. Record any redirects;
this procedure does not change or select canonical-host behavior.

### Application route

In a browser or equivalent read-only request:

1. Load the public landing page and confirm that expected Bowling Green
   Highlands content renders.
2. Follow the landing page's primary reservation action to the current public
   reservation-entry route. This avoids assuming an unverified route URL.
3. Confirm that the reservation-entry page renders expected application content
   rather than a 404, provider placeholder, or application error.
4. Do not submit a reservation request, payment, Admin action, or other
   production mutation as part of this DNS recovery verification.

Failure at any verification layer means recovery is incomplete.

## Recovery evidence checklist

Retain the following evidence for an authorized recovery or controlled recovery
exercise. Do not record passwords, session material, or other secrets.

- [ ] Recovery authorization or incident reference
- [ ] Date, time, and operator
- [ ] Source and date used to reconfirm the approved targets
- [ ] Public nameservers before restoration
- [ ] Apex and `www` values and TTLs before restoration
- [ ] Exact record-level changes made, including preserved or changed TTLs
- [ ] Confirmation that unrelated records were unchanged
- [ ] DNSSEC and delegation observations
- [ ] Public NS, A, and CNAME results after restoration
- [ ] Authoritative DNS comparison, if used
- [ ] HTTPS results for apex and `www`, including certificate validation
- [ ] Application landing-page result
- [ ] Reservation-entry route URL and result
- [ ] Outstanding errors, unexpected records, or follow-up actions
- [ ] Final outcome: successful, incomplete, or stopped
- [ ] Recovery-test status and evidence location

The status may be changed from **not tested** only after an authorized recovery
or controlled exercise completes this checklist successfully and retains the
evidence. Writing or reviewing this procedure alone is not a recovery test.

## Explicit exclusions

This procedure does not authorize:

- a DNS change without separate operational approval;
- a DNS zone reset, bulk deletion, or unrelated record change;
- disabling or changing DNSSEC;
- changing Vercel project, domain, redirect, or deployment configuration;
- changing application, persistence, mail, or infrastructure behavior;
- adding or revealing secrets or credentials;
- estimating DNS propagation time; or
- claiming that production DNS recovery has been tested.
