# AGENTS.md

Purpose: enforce operating rules for Bowling Green Highlands.
Prevent drift. Preserve simplicity. Keep work aligned to the real product.

If instructions conflict:
- direct user instruction > AGENTS.md > other files

---

## Product Identity

Bowling Green Highlands is a reservation + availability system for a working farm.

It is NOT:
- a generic website
- a booking platform
- an auto-confirm system

MVP:
- operators block/unblock dates
- users request available dates only
- reservations are request-based
- blocked dates cannot be selected
- no payments

---

## Core Model

Operators:
- control availability via calendar

Users:
- see availability
- select available dates only
- submit request
- receive confirmation that the request was submitted

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
- understand availability
- block a date
- complete the core action

within 30 seconds.

Fail = not ready.

---

## Calendar Constraints

- day-level only
- no time slots
- no drag/drop
- no recurrence
- no complex controls

Availability must be instantly clear.

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

## Scope Discipline

Prefer:
- simplicity over completeness
- usability over elegance
- low maintenance over feature depth

Never introduce without an issue:
- payments
- auth expansion
- advanced scheduling
- speculative infrastructure
- multi-step flows

---

## Local Memory

Local-only files may be untracked:
- `docs/codex/PROJECT_MEMORY.md`
- `docs/codex/CURRENT_STATE.md`

Use them for continuity, not as source of truth over committed repo files.

---

## Definition of Done

- behavior works
- result is visible or testable
- flow remains intact
- no regression introduced
- smoke test passes

---

## Stop Conditions

STOP if a change would:
- break the availability-first model
- introduce auto-confirmation
- add payments
- add time-slot scheduling
- add extra steps to the public flow
- exceed issue scope