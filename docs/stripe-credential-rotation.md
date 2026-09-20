# Stripe Credential Rotation Runbook

## Purpose and scope

This runbook covers planned and emergency rotation of the server-side Stripe
credentials used by Bowling Green Highlands (BGH). It does not authorize access
to the client-owned Stripe or hosting accounts. Only an authorized client or
operator may approve and perform these procedures.

The current integration:

- creates Stripe Checkout Sessions for accepted reservation requests
- verifies webhook signatures with a separate endpoint signing secret
- persists only the payment status from a verified payment event; it does not
  store Stripe credentials or Stripe payment identifiers
- remains request-based, so payment does not confirm a reservation

Vercel is the current deployment platform. On another server-capable host, use
that host's protected environment-variable or secrets manager and create a new
deployment or restart the server process so it loads the replacement value.

## Keep sandbox and live work separate

Treat every Stripe sandbox and live environment as an independent rotation.
Never mix keys, Prices, webhook endpoints, or signing secrets across modes or
deployment environments.

- Rehearse the complete procedure in a Stripe sandbox and its matching
  non-production deployment first.
- Do not treat sandbox validation as evidence that a live rotation succeeded.
- Perform a live rotation only after explicit go-live approval and within a
  separately authorized live change window.
- Record only safe references such as the environment name, credential label,
  endpoint label, deployment identifier, times, and validation result. Never
  record credential values.

## 1. Credential inventory and ownership

| Item | Application setting | Sensitivity and use | Owner |
| --- | --- | --- | --- |
| Restricted API key, or unrestricted secret key only when justified | `STRIPE_SECRET_KEY` | Secret server-side credential used to create Checkout Sessions. The environment-variable name does not require the credential to be unrestricted. | Authorized client/operator with access to the client-owned Stripe and hosting accounts |
| Webhook signing secret | `STRIPE_WEBHOOK_SECRET` | Secret for one specific Stripe webhook endpoint and mode; used to verify signatures independently of the API key. | Authorized client/operator with access to the matching Stripe endpoint and hosting environment |
| Price ID | `STRIPE_CHECKOUT_PRICE_ID` | Environment-specific, non-secret identifier for the configured Price. It must match the API key's Stripe mode and account. | Authorized client/operator responsible for the matching Stripe resources and deployment configuration |

The Stripe account and hosting account are client-owned. Limit account and
secret-manager access to authorized client/operators. Never place any value
from this inventory in Git, source files, documentation, screenshots, chat,
email, tickets, or incident notes. Enter secret values directly from Stripe
into the hosting platform's protected configuration or an approved secrets
vault.

## Maintenance expectations and responsibility

No weekly Stripe or hosting login is required for credential maintenance.
Stripe API keys and webhook signing secrets do not require weekly renewal, and
routine reservation or payment activity is separate from credential
maintenance.

The client account owner must designate an authorized maintainer and must send
client-owned security notifications to an address that is actively monitored.
The developer has no recurring monitoring or account-access obligation unless
a separate maintenance agreement explicitly assigns it.

| Timing | Action |
| --- | --- |
| Weekly | No credential-maintenance action required. |
| Immediately | Respond to suspected exposure, lost credentials, security alerts, or personnel/access changes. |
| Quarterly | Confirm authorized users, MFA, and notification recipients; do not reveal or rotate credentials solely for this review. |
| Annually | Review the runbook and optionally rehearse rotation in Stripe test mode. |
| Live rotation | Perform only for a security event, provider requirement, hosting change, or client-approved policy. |

| Situation | Client risk |
| --- | --- |
| No designated maintainer | Alerts and failures may go unanswered. |
| Exposed key not replaced | Unauthorized Stripe activity may continue. |
| API key changed without updating hosting | Checkout cannot start. |
| Webhook secret changed without updating hosting | Valid payments may not be recorded as paid. |
| Old credential revoked before validation | Payment outage and loss of rollback. |
| Test and live resources mixed | Checkout may fail, or test payments may be mistaken for real payments. |
| Credentials shared through email, chat, screenshots, issues, or documentation | The Stripe or hosting account may be compromised. |
| Notifications sent to an unattended address | Security response may be delayed. |

The quarterly and annual activities are recommended safeguards. They are not
weekly technical requirements and do not imply a recurring developer support
commitment.

## 2. Least-privilege decision

Prefer a restricted API key. Repository code currently makes one Stripe API
call: it creates a Checkout Session. Webhook signature verification uses the
separate endpoint secret and does not justify additional API-key permissions.

Use this permission decision process:

1. In a Stripe sandbox, create a restricted API key for the matching sandbox.
2. Set **Checkout Sessions: Write** as the starting permission.
3. Set every unrelated permission to **None**.
4. Configure the matching non-production deployment to use that key and
   redeploy it.
5. Exercise Checkout Session creation and review the replacement key's Stripe
   request logs.
6. If a request fails for permissions, add only the permission identified by
   that failed request, document the demonstrated requirement without copying
   request bodies or credentials, and repeat the sandbox test.
7. Use an unrestricted secret key only if sandbox evidence proves that the
   restricted key is insufficient. Document the specific failed operation and
   reason for the exception before using the unrestricted key.

Do not grant speculative permissions. Successful sandbox Checkout creation and
the associated Stripe request log are required before reproducing the tested
restricted-key permissions in live mode.

## 3. Planned API-key rotation

Complete these steps for one environment and one Stripe mode at a time:

1. Confirm the target Stripe account or sandbox, deployment environment, and
   current API-key label. Do not reveal or copy the current value into notes.
2. Create a replacement key of the approved type and permissions. Prefer the
   restricted permissions validated in the sandbox; retain any unrestricted
   exception only with its documented evidence. Do not immediately invalidate
   the former key.
3. Update `STRIPE_SECRET_KEY` only in the matching deployment environment.
   Keep the matching Price ID and webhook endpoint resources unchanged.
4. Redeploy the target application. Vercel environment-variable changes apply
   only to new deployments; another host must likewise deploy or restart the
   server process if required to load the new value.
5. Create a Checkout Session from an accepted validation reservation
   appropriate to that environment and confirm the request succeeds.
6. Review Stripe request logs for the replacement key. Confirm the expected
   Checkout Session creation request succeeds and no unrelated API calls occur.
7. Monitor the former key's request logs until it has no remaining application
   traffic.
8. Revoke or allow the former key to expire only after the replacement
   deployment and Checkout validation succeed.

When its Dashboard rotation flow is used, Stripe currently supports a grace
period in which the former and replacement API keys can both work for up to
seven days. Confirm the current Dashboard option and the displayed expiration
during every rotation; do not assume the maximum grace period will always be
available or selected.

## 4. Webhook-secret rotation

The webhook signing secret is specific to one endpoint and Stripe mode. Rotate
it separately from the API key:

1. Confirm the exact sandbox or live webhook endpoint that targets the intended
   deployment's `/api/stripe/webhook` route.
2. Roll that endpoint's signing secret and select delayed expiration for the
   former secret. Stripe currently supports a delay of up to 24 hours; confirm
   the displayed expiration before continuing.
3. Update `STRIPE_WEBHOOK_SECRET` only in the matching deployment environment.
4. Redeploy the target application so it loads the replacement secret.
5. Send a signed event from the matching Stripe environment and confirm the
   webhook delivery returns a successful response.
6. Confirm that a valid paid event for an accepted reservation persists paid
   status. Also confirm that it does not change reservation status,
   availability, or booking truth.
7. Review the endpoint's Stripe delivery logs. Allow the former signing secret
   to expire only after successful delivery and paid-state persistence are
   verified.

Immediate expiration before the replacement deployment is active can interrupt
signature verification. During Stripe's delayed-expiration window, Stripe
signs for each active endpoint secret so the newly deployed verifier can accept
events signed with the replacement secret.

## 5. Emergency rotation

Use emergency rotation when an API key or webhook signing secret is suspected
to be exposed:

1. Restrict access to the affected systems and stop any process that is
   continuing to expose the value. Notify the authorized client/operator
   through the approved incident channel without including the value.
2. Identify the affected Stripe mode, endpoint or key label, and deployment
   environment. Do not copy the suspected value into searches or notes.
3. Create or roll the replacement credential in Stripe.
4. Replace the matching protected environment variable in the deployment
   platform, then redeploy or restart the application so it loads the new
   value.
5. Run the applicable Checkout or webhook validation checklist below.
6. Revoke the compromised credential as soon as the replacement path is
   validated. If active misuse makes continued validity unsafe, revoke it
   immediately and accept temporary payment unavailability while deploying the
   replacement.
7. Review Stripe request or webhook delivery logs for unexpected activity.
8. Review repository history and secret-scanning results for exposure without
   reproducing the value. Follow the approved incident process for any history
   remediation or further account review.

Never paste the compromised value into incident notes, GitHub issues, tickets,
chat, email, screenshots, shell history, or repository-search output.

## 6. Rollback and validation

Rollback is available only while the former credential remains active. Restore
the former value in the matching protected environment, create a new deployment
or restart the server process, and repeat the applicable validation checklist.
On Vercel, do not assume that changing an environment variable updates an
existing deployment or that an instant deployment rollback loads the edited
value.

An expired or revoked API key or webhook signing secret cannot be recovered as
a rollback credential. Create or roll another credential instead.

### Sandbox Checkout validation

- Confirm the deployment uses only the matching sandbox API key, sandbox Price
  ID, application URL, and sandbox webhook resources.
- From an accepted sandbox reservation, start payment and confirm the
  application creates a Checkout Session and redirects to hosted Checkout.
- Confirm the replacement key's Stripe request log shows the successful
  Checkout Session creation request.
- Confirm the former key has no remaining application traffic before expiry or
  revocation.
- Confirm no booking confirmation, reservation-status change, or availability
  change occurs from Checkout creation or browser return state.

### Live Checkout validation

- Proceed only with explicit live-payment and change-window approval.
- Confirm the deployment uses a complete matching live resource set; do not
  reuse any sandbox key, Price, endpoint, or signing secret.
- Perform only the approved controlled Checkout transaction.
- Confirm the replacement key's live request log shows the expected successful
  Checkout Session creation and no unrelated calls.
- Confirm the former live key has no remaining application traffic before
  expiry or revocation.
- Confirm payment still does not establish booking confirmation.

### Sandbox webhook validation

- Confirm the endpoint, signing secret, and deployment all belong to the same
  sandbox environment.
- Send a matching signed paid event for an accepted sandbox reservation.
- Confirm Stripe records a successful webhook response.
- Confirm BGH persists the reservation's payment status as paid.
- Confirm reservation status, availability, and request-based booking truth are
  unchanged.

### Live webhook validation

- Proceed only with explicit live-webhook validation approval.
- Confirm the endpoint, signing secret, and deployment all belong to the same
  live environment.
- Use only the approved live validation event or controlled transaction.
- Confirm Stripe records a successful webhook response and BGH persists paid
  status for the intended accepted reservation.
- Confirm reservation status, availability, and request-based booking truth are
  unchanged before allowing the former signing secret to expire.

## Primary references

- [Stripe API keys and rotation](https://docs.stripe.com/keys)
- [Stripe restricted API keys](https://docs.stripe.com/keys/restricted-api-keys)
- [Stripe webhook signing-secret rotation](https://docs.stripe.com/webhooks#roll-endpoint-secrets)
- [Vercel secret rotation](https://vercel.com/docs/environment-variables/rotating-secrets)
