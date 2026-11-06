# Bowling Green Highlands — Backlog, Ideas & Decisions Register

> **Snapshot:** November 6, 2026. This is a planning/decision record, not an implementation authorization. [GitHub Issues](https://github.com/gacurl/bowling-green-highlands/issues) is the authoritative live tracker; the list below is a dated snapshot.
>
> **Authority:** This register never overrides [AGENTS.md](../../AGENTS.md) or [docs/SYSTEM_TRUTHS.md](../SYSTEM_TRUTHS.md). If this register conflicts with either authority, follow the authority and correct this register.

> **Focus first: payment checkout (#309)** — Restore the existing accepted-reservation checkout before extending payments. In parallel, finish backup, smoke-test, and owner-access evidence. Keep optional revenue features outside the current MVP readiness gate.

## Open issues — proposed triage

| OPEN ISSUE & EXACT TITLE | LANE | ORDER | RISK |
| --- | --- | --- | --- |
| [#309](https://github.com/gacurl/bowling-green-highlands/issues/309) · Issue 8-36: Diagnose and restore accepted-reservation payment checkout | Payment | NOW | Medium |
| [#110](https://github.com/gacurl/bowling-green-highlands/issues/110) · Issue 8-4: Create operational backup and recovery guidance | Operations | NOW | Medium |
| [#111](https://github.com/gacurl/bowling-green-highlands/issues/111) · Issue 8-5: Add production smoke validation checklist | Operations | NOW | Low |
| [#264](https://github.com/gacurl/bowling-green-highlands/issues/264) · Issue 8-25: Complete owner password setup and client Admin handoff | Owner handoff | NOW | Low–Med |
| [#265](https://github.com/gacurl/bowling-green-highlands/issues/265) · Issue 8-26: Create repeatable production deployment evidence and rollback procedure | Operations | NEXT | Medium |
| [#112](https://github.com/gacurl/bowling-green-highlands/issues/112) · Issue 8-6: Reduce production dependency fragility | Maintenance | NEXT | Medium |
| [#113](https://github.com/gacurl/bowling-green-highlands/issues/113) · Issue 8-7: Perform final production readiness review | Readiness gate | GATE | Low |
| [#310](https://github.com/gacurl/bowling-green-highlands/issues/310) · Issue 8-37: Support reservation retainers and remaining balance payments | Revenue | LATER | High |
| [#311](https://github.com/gacurl/bowling-green-highlands/issues/311) · Issue 8-38: Add owner-managed merchandise purchasing links | Revenue | LATER | Low–Med |

This nine-item snapshot intentionally excludes [#312](https://github.com/gacurl/bowling-green-highlands/issues/312), the documentation issue that creates this register.

“Order” is a recommendation, not a GitHub label or status. Risk describes delivery complexity, not confirmed severity.

## What to do, and in what order

### A. Stabilize the working farm system

- #309 — Investigate the broken payment link end-to-end. Test safely with matching Stripe test resources; no real charges or Production credential changes without approval.
- #110 — Write and verify a minimal database backup/restore procedure that does not put new Production data at risk.
- #111 — Record a short repeatable smoke checklist: public request, blocked dates, Admin calendar, email, persistence, and payment mode.
- #264 — Reconcile existing owner password setup against evidence; verify owner login, calendar, requests, and recovery responsibility. Do not reset credentials simply because the issue remains open. Its issue lists completed #261 and #263, plus open #111, as dependencies.

### B. Make releases repeatable

- #265 — Its issue lists #110, #111, and #113 as dependencies. Reconcile its relationship with the final readiness review before work begins. Reference the already-merged milestone release workflow rather than duplicating it.
- #112 — Recheck current dependency findings before changing packages. The old issue cites historical Next.js/PostCSS audit results, which must not be treated as a current vulnerability report.
- #113 — Run the final readiness review after the operational blockers are resolved or explicitly accepted. Assess the currently committed MVP, not every optional future feature.

### C. Add revenue capabilities without expanding the platform

- #310 — Depends on #309. Model retainer paid versus paid in full correctly; preserve existing payments and webhook integrity. This is the highest-complexity planned enhancement.
- #311 — Independent of #310. Start with a single “Shop Farm Merchandise” destination to an owner-managed provider; no cart or inventory inside BGH.

> **Dependency record:** #310 depends on #309. #264 lists #261, #263, and #111. #265 lists #110, #111, and #113. #311 has no stated dependency on #310. Proposed sequencing beyond these issue-level statements remains a recommendation.

### Do not confuse these states

Code merged ≠ Vercel READY ≠ live-site verified ≠ payment verified ≠ owner accepted. Record each separately. The existing release workflow also needs its protected milestone-release environment configured before a real publication; that is operational follow-up, not a new product feature.

## Complexity parking lot

These are candidate improvements, not open issues. Create a separate issue only when owner evidence proves a real need.

| POSSIBLE FUTURE NEED | LOW-FRICTION FIRST OPTION | DO NOT BUILD YET |
| --- | --- | --- |
| Seasonal announcement cleanup | Manual removal or one simple owner-controlled show/hide setting after the event | General-purpose page builder or campaign CMS |
| Copy-ready guest messages | One “Copy message” action after accepting a request; owner sends manually | Automated email journey / CRM |
| Unpaid retainer follow-up | Use Stripe-native invoices or manual follow-up after #310 is proven | Recurring billing, late-fee engine, automatic cancellation |
| Merchandise size/stock complexity | Use hosted store/provider inventory tools if needed | Custom SKU inventory and fulfillment inside BGH |
| Owner reporting | Use a concise count or filtered request list only if it changes daily decisions | Analytics dashboards and account systems |

### Hard limits — keep out of the backlog

No auto-booking, generated time slots, recurrence, drag-and-drop calendars, custom payment processor, bespoke shopping cart, customer accounts, or hidden approval flows. Reservation requests remain operator-controlled; blocked/unconfigured dates remain unavailable.

### Decision rule for any new issue

1. Observed owner or guest friction: what actually failed or took too long?

2. One primary action: can a nontechnical operator complete it without instruction?

3. Can an existing provider handle pricing, orders, delivery, or reminders?

4. Can we solve it in one issue, one branch, one concern, one PR with a visible smoke test?

### Working agreement

Treat this document as a prioritization aid, not permission to implement. For each issue: read the latest AGENTS.md and docs/SYSTEM_TRUTHS.md; Codex Prompt A inspects and designs, then stops for approval; Prompt B implements and tests, then stops. Explicit file staging, protected main, human review, and current evidence remain mandatory.

Source: nine open issue descriptions and issue IDs supplied or verified on November 6, 2026. Sequencing, risk ratings, and parking-lot ideas are recommendations—not existing GitHub commitments.

## Previously discussed ideas

Recovered from earlier BGH planning discussions; not a complete transcription of every chat. Recording an idea does not approve implementation.

### Owner-requested or directly relevant ideas

| IDEA / EARLIER CONTEXT | RECORD STATUS | LOW-FRICTION PATH / TRIGGER |
| --- | --- | --- |
| Farm blog or journal — requested early in the project | PARKED · Owner interest; no open issue identified | Only consider after owner provides a sustainable content cadence. Start with a few static stories, not a blog platform. |
| Google Maps business listing — raised during owner planning | OPERATIONS · No BGH issue identified | External listing/ownership task; verify completion and correct farm information. No app integration required. |
| Owner-managed public images — earlier Issue #104 | COMPLETED ISSUE · #104 closed | Verify existing capability before proposing any new photo-management work. Avoid reopening by assumption. |
| Seasonal announcement control — follow-up to Christmas flyer #296 | PARKED · Suggestion; not an issue | Manual cleanup first; a single show/hide control only if the owner repeatedly needs it. |
| Farm story / cattle identity / visitor expectations — May UX concepts | PARKED · Suggestions; no new issue | Evaluate current homepage before deciding a simple story or visit-information improvement would increase requests. |
| Copy-ready messages after accepting a request | PARKED · Suggestion; not an issue | One owner action to copy a customer-facing message. Do not add a CRM or automatic messaging. |
| Basic owner reporting / quick view | PARKED · Suggestion; not an issue | Only if owners cannot answer a real daily question using existing request list. No dashboard by default. |

### Already tracked elsewhere — avoid duplicates

- #309: broken checkout; #310: retainer/balance; #311: merchandise links. These are open GitHub issues, not parking-lot ideas.
- #296: seasonal Christmas flyer shipped; #100: structured homepage content and #104: image management were previously completed/closed. Reconcile existing features before filing follow-ups.
- Issue #307 is closed, and its milestone-release workflow is present in the repository. Creating the protected milestone-release environment and running its read-only validation remain operational follow-ups, not a new product feature.

## Deferred is not forgotten

Separate viable low-friction ideas from proposals that would change the nature of BGH. Maintain this register, not GitHub issues, until there is a concrete owner need.

### Explicitly deferred or still unproven

| CONCEPT | WHY IT STAYS PARKED | REVISIT ONLY IF |
| --- | --- | --- |
| Automatic acceptance / payment emails | Owner currently manually sends accepted-request payment links. An automatic invoice workflow introduces delivery and reconciliation concerns. | Repeated owner effort is observed and the existing payment flow is reliable. |
| 72-hour retainer deadline reminders | The owner’s advertised policy is not a system-enforced timer. Automatic cancellation risks violating request/acceptance truth. | Owner requests a specific manual reminder or Stripe-native method after #310. |
| Event price/catalog expansion | Owner-managed Stripe products are preferred; building custom CMS pricing adds maintenance. | A concrete recurring pricing problem remains after #310 and #311. |
| More photos, video, content library, educational/community features | Early content-platform possibilities, not current reservation-system requirements. | Demand is demonstrated and a single scoped change clearly increases trust or requests. |
| Rescheduling and refunds | Original planning excluded full refund/reschedule workflows. Payment terms and operational ownership remain undefined. | Owners identify a repeated real-world process requiring support; scope individually. |
| Christmas 15-minute photo operations | Flyer advertises 15-minute sessions; the site collects preferred times without slot generation or auto-booking. | Owner reports actual capacity/communication friction; do not infer a need for a scheduling engine. |

### Explicitly out of scope unless project direction changes

Customer accounts; automatic booking confirmations; automated slot generation; overlapping capacity/recurrence scheduling; drag-and-drop; full messaging/CRM; complex analytics; custom inventory/cart/fulfillment; custom payment processor; generalized page builder; unnecessary integrations. These are decisions, not missing tickets.

### How to maintain the register

- Capture any new idea with its source: owner request, observed guest/operator friction, or assistant suggestion.
- Give it exactly one status: OPEN ISSUE, COMPLETED, PARKED, OPERATIONAL FOLLOW-UP, or EXCLUDED.
- Promote PARKED → GitHub issue only when the owner agrees, the value is concrete, and scope fits one issue / branch / PR.
- At each readiness review, reconcile the nine-issue tracker and these ideas; do not silently implement parked concepts.

Source note: current issues were verified against GitHub on Nov 6, 2026; idea provenance comes from earlier project conversations. This register is a best-effort recovery, not proof every historical conversation or idea has been indexed.

