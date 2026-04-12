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
- no slot selection exists yet
- no real booking is confirmed by the system

## Target Direction

The target MVP is slot-based:
- operators define availability windows
- system generates time slots automatically
- users select and reserve a time slot
- slots cannot be double-booked
- confirmation reflects the real reservation state

---

## Core Model

Current model:
- user submits a requested date for operator review
- operator follows up outside the app

Target model:
Operators:
- choose a date
- define available time window
- system generates slots using a fixed duration
- optionally close specific slots

Users:
- see available slots
- select one slot
- complete reservation

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
- treat the product as request-based until slot behavior is actually implemented

Target-state rule:
- slots are auto-generated
- fixed slot duration (default 30 minutes unless ticketed otherwise)
- no recurrence rules
- no drag/drop scheduling
- no complex calendar interactions
- no explanation-heavy controls

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
