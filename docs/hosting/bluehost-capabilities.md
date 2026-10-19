# Bluehost Account and DNS Capabilities

**Issue:** #266 / Issue 8-8a

**Verification date:** 2026-10-19

## Purpose and scope

This document records Bluehost account and DNS capabilities verified through
manual account inspection, public DNS queries, and HTTPS requests.

The architecture direction for this verification is:

- retain Bluehost for the `bowlinggreenhighlands.com` domain and DNS;
- retain Vercel for Next.js application hosting;
- do not use this evidence to select or approve an alternative application
  host;
- leave final architecture approval to Issue #268; and
- leave durable persistence implementation to Issue #261.

No Bluehost hosting, Node.js runtime, application-storage, or backup capability
is inferred from the presence of a cPanel tool.

## Bluehost account

The authenticated Bluehost account inspection confirmed:

| Capability | Verified evidence |
| --- | --- |
| Plan | Bluehost Business Hosting |
| Domain | `bowlinggreenhighlands.com` |
| Control panel | cPanel is available |
| Storage allocation | 50 GB |
| Website allowance | 50 websites |
| Data center | Ashburn, United States |

These account limits describe the purchased Bluehost plan. They do not by
themselves establish that Bluehost can run this Next.js application or provide
durable application storage.

## cPanel capabilities

Manual cPanel inspection produced the following results:

| cPanel capability | Verification status | Boundary |
| --- | --- | --- |
| Zone Editor | Available | Confirms DNS record management is available. |
| SSH Access | Tool visible | Does not confirm that SSH is enabled or that a persistent application process can run. |
| Backup | Tool visible | Does not confirm retention, scope, scheduling, or restore behavior. |
| Backup Wizard | Tool visible | Does not confirm retention, scope, scheduling, or restore behavior. |
| SSL/TLS Certificates | Tool visible | Does not change the observed fact that Vercel currently serves HTTPS for the public hostnames. |
| MySQL management | Tools visible | No database capability was tested or selected. |
| Setup Node.js App | Not found in cPanel search | Node.js runtime support remains unverified. |
| Terminal | Not visible | Shell access through a browser terminal remains unverified. |

The following Bluehost application-hosting capabilities remain **unverified**:

- Node.js runtime support;
- durable Bluehost application storage; and
- backup retention and restore behavior.

They are not required to retain Bluehost in the domain and DNS role described
by this issue.

## Authoritative DNS

Public `dig` queries confirmed that Bluehost nameservers are authoritative for
the domain:

```text
ns1.bluehost.com
ns2.bluehost.com
```

The public application records were confirmed as:

| Name | Type | Target |
| --- | --- | --- |
| `bowlinggreenhighlands.com` | A | `216.198.79.1` |
| `www.bowlinggreenhighlands.com` | CNAME | `05595c7797e7e96e.vercel-dns-017.com` |

The Bluehost Zone Editor provides record management for the domain. A DNSSEC
toggle was observed and was disabled at the time of verification.

No DNS changes were performed during this investigation.

## Existing mail-related DNS

The existing DNS zone also contains:

- MX records targeting `mail.bowlinggreenhighlands.com`; and
- an existing SPF TXT record.

All existing mail-related records must be preserved during any future DNS
work. This verification did not test mail delivery or change mail records.

## HTTPS verification

Public `curl -IL` requests confirmed:

| URL | Result |
| --- | --- |
| `https://bowlinggreenhighlands.com` | HTTP/2 200 |
| `https://www.bowlinggreenhighlands.com` | HTTP/2 200 |

For both hostnames:

- the response reported `server: Vercel`;
- the response reported `x-powered-by: Next.js`;
- an HSTS header was present;
- no redirect was observed; and
- HTTPS certificate validation succeeded through `curl`.

This confirms that both public hostnames directly serve the Next.js
application through Vercel over valid HTTPS. It does not determine whether one
hostname should become canonical; no redirect behavior was changed or approved
by this issue.

## Verified conclusion

The collected evidence supports retaining Bluehost for the current domain and
authoritative DNS role:

- Bluehost provides access to the authoritative DNS zone through Zone Editor.
- The apex and `www` records currently route public traffic to infrastructure
  served by Vercel.
- Both hostnames return the Next.js application successfully over HTTPS.
- Existing mail-related DNS is present and must remain undisturbed.

This document does not approve the final production architecture, alter DNS,
establish durable persistence, or verify Bluehost as an application host. Final
architecture approval remains with Issue #268, and durable persistence remains
with Issue #261.
