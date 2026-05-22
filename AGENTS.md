# AGENTS.md

Purpose: enforce operating rules for Bowling Green Highlands.
Prevent drift. Preserve simplicity. Keep work aligned to the real product.

If instructions conflict:
- direct user instruction
- AGENTS.md
- repo state
- docs/codex/* continuity files

docs/codex/* files are context-only unless the user explicitly promotes them.

---

## Required Architectural Reference

Before implementing features, review:

- docs/SYSTEM_TRUTHS.md

System truths override convenience, feature expansion, or speculative architecture.

All implementation decisions must preserve:

- request-based reservation truth
- operator-controlled availability
- low cognitive load
- MVP-first simplicity
- one primary action per screen

---

## Product Identity

Bowling Green Highlands is an availability and reservation system for a working farm.

It is NOT:
- a generic website
- a full scheduling platform
- a complex booking engine
- a feature playground

## Current Behavior

The current system is request-based:
- guests submit a reservation request
- the app forwards the request by email to the operator
- operators manage day-level availability
- unavailable dates cannot be requested
- unconfigured dates are unavailable by default
- no real booking is confirmed by the system

No payments are live.
No auto-booking is live.
No scheduling suite behavior is in scope.

---

## Core Model

Current model:
- operator sets day availability as available or unavailable
- public availability is derived from operator availability
- users can only request dates that are currently available
- user submits a reservation request for operator review
- operator follows up outside the app
- request submission is not booking confirmation

If this model breaks, the feature is invalid.

---

## Core Flow

`landing → reserve → confirmation`

Constraints:
- max 3 steps
- no dead ends
- no passive pages
- one primary action per screen

---

## UX Standard

All work must pass:

### Flow
User always knows what happens next.

### Conversion
Next action is obvious within 3 seconds.

### Clarity
No instructions required. Plain language only.

Priority:
1. clarity
2. conversion
3. flow
4. simplicity
5. extensibility

---

## 30-Second Rule

A normal user must be able to:
- understand the current request flow
- see what happens next
- complete a reservation

within 30 seconds.

Fail = not ready.

---

## Scheduling Constraints

Current-state rule:
- treat the product as request-based with day-level availability truth
- operators are the availability source of truth
- unavailable dates cannot be requested
- unconfigured dates are unavailable by default
- no auto-booking
- no payment assumptions
- no recurrence rules
- no drag/drop scheduling
- no complex booking-platform interactions

Keep scheduling simple and fast.

---

## Engineering Posture

Build systems, not pages.

Prefer:
- simple frontend that drives action
- minimal backend
- MVP-first scope
- low-maintenance implementation
- real behavior over placeholder behavior

Avoid:
- premature infrastructure
- speculative abstractions
- hidden flows
- fake booking behavior
- scope creep

---

## Security and Delivery Baseline

Security and delivery are part of the baseline, not stretch goals.

Required posture:
- CI must stay passing
- build must stay passing
- security workflows remain enabled
- no dependency or config change without checking blast radius

Do not introduce:
- unsafe secrets handling
- undocumented env changes
- silent workflow breakage

---

## Workflow Discipline

- one issue per branch
- one concern per issue
- explicit staging only
- smoke test before completion
- no mixed changes

Branch:
`issue-X-Y-short-description`

Commit:
`Issue X-Y: short description`

---

## Codex Execution Rule

Before implementation:
- the correct issue branch must already be checked out
- Codex must work only on that branch
- prompts should name the issue branch when relevant

Codex must NOT:
- create or switch branches
- modify unrelated files
- expand scope beyond the issue
- treat docs/codex/* as more authoritative than AGENTS.md or repo state

---

## Source-of-Truth Hierarchy

When deciding what to trust:

1. direct user instructions
2. AGENTS.md
3. actual repo code and config
4. committed project docs
5. local continuity docs in `docs/codex/*`

If continuity docs conflict with repo truth, repo truth wins unless the user says otherwise.

---

## Local Memory

Local-only files:
- `docs/codex/PROJECT_MEMORY.md`
- `docs/codex/CURRENT_STATE.md`

Use for continuity only.
Do not treat them as authoritative over committed repo files.

---

## TypeScript Import Rule (Critical)

- Do NOT include `.ts` extensions in import paths
- Always use extensionless imports

Correct:
import { example } from "./example"

Incorrect:
import { example } from "./example.ts"

Violation will break CI builds.

---

## Definition of Done

- behavior works
- result is visible or testable
- flow remains intact
- no regression introduced
- smoke test passes
- CI risk is understood
- scope matches the issue

---

## Stop Conditions

STOP if a change would:
- introduce complex scheduling behavior beyond the issue
- break the 3-step flow
- add unnecessary user friction
- weaken system truth
- change persistence/auth/payment behavior without an issue
- create drift between docs and actual product behavior
