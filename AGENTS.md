# AGENTS.md

Purpose: enforce operating rules for Bowling Green Highlands.
Prevent drift. Preserve simplicity. Keep work aligned to the real product.

Use the Source-of-Truth Hierarchy below when instructions conflict.
`docs/codex/*` files are continuity context, not authority, unless explicitly promoted by the user.

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

## Workflow Discipline — Mandatory Guardrails

**One issue → one branch → one concern → one PR.** This is a gate, not a suggestion.

- Begin from synchronized `main` when opening a **new** issue branch; never switch away from an active issue merely to restart completed work.
- Use the existing issue branch for follow-up work. Never mix unrelated changes.
- Branch naming: `issue-X-Y-short-description` (use the issue's established naming convention).
- Commit subject: `Issue X-Y: short description`.
- The GitHub PR title must **exactly match the GitHub issue title**.
- Do not change persistence, authentication, payments, deployment, or infrastructure within an unrelated issue.
- Stage only named, authorized files. **Never use `git add .`, `git add -A`, or blanket staging**.
- Do not commit, push, open a PR, or merge without the human's authorization at the applicable gate.
- Respect protected `main`; never force-push.

### Two-phase Codex gate

1. **Prompt A — Inspect → Design → STOP.** Inspect only relevant files, identify minimal scope, propose a design, and await human approval. No implementation.
2. **Prompt B — Implement → Test → STOP.** Implement only the approved scope, run focused tests, report changed files and outcomes, and await human review.

If either phase was already completed, **do not repeat it**. Reconnaissance after Prompt B must be narrowly justified by a concrete unanswered question; it is not an automatic extra phase. The human, not Codex, manages branch creation and switching.

### Validation gate — evidence, not ceremony

- Verify affected behavior with focused tests and a meaningful smoke test before calling it done.
- Use previously verified PASS results unless code or environment changes invalidate them.
- Do **not** repeat passing tests, perform broad scans, dump huge diffs, or run expensive builds without a specific reason or required CI gate.
- Distinguish code inspection, simulated/browser verification, real persistence, and CI results. Never label untested behavior PASS.
- Confirm only the intended files are changed before staging; `git diff --check` and an appropriate concise change summary are sufficient when earlier review was completed.
- On unexpected changes, failing tests, or unsafe environment ambiguity: **STOP** and report the specific blocker. Never hide or overwrite unrelated work.
- CI, build, and security gates remain mandatory; do not weaken or bypass them to accelerate a PR.

### Final handoff gate — exactly two deliverables

**After** implementation, human review, and relevant testing have passed, give the user, in **one response**:

1. **One consolidated `~~~bash` block** containing explicit `git add <authorized files>`, `git commit -m "Issue X-Y: ..."`, and `git push -u origin <issue-branch>` commands. No extra validation-only round trips unless a new risk has appeared. Do not run those commands yourself without authorization.
2. **One copy-ready `~~~markdown` PR block** containing the **exact full issue title inside the block** (first line `# Issue X-Y: ...`), then the summary, `Closes #<GitHub issue number>`, actual validation evidence, scoped files, and any unverified limitations. Never put the title only outside the PR block.

The PR title is not the commit subject unless they happen to be identical. Keep GitHub issue numbers (`#284`) distinct from issue identifiers (`8-28`). Do not invent PASS results.

### Interaction and pacing gate

- Maximum **two operational steps per response**, not two separate conversations for naturally coupled Git operations.
- Keep a coherent operation consolidated. Do not split staging, commit, and push into repeated checkpoints after approval.
- Use PASS/FAIL only for material validation or actual blockers; do not force a checkpoint after every shell command.
- Ask for evidence only when it would change the next action. Do not ask for information already provided.
- Prefer concise, copy-ready instructions and the shortest safe route to closure.
- Preserve established fences: Git commands `~~~bash`; Codex prompts `~~~text`; GitHub issues, PR descriptions, and handoffs `~~~markdown`.

---

## Codex Execution Rule

Before implementation:
- the correct issue branch must already be checked out
- Codex must work only on that branch
- prompts must identify the active issue and branch
- respect the two-phase Codex gate above

Codex must NOT:
- create or switch branches
- modify unrelated files
- expand scope beyond the approved issue
- restart finished phases or invent repetitive validation gates
- stage, commit, push, or open a PR without explicit authorization
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
- authorized files only; temporary harnesses and debug changes removed
- PR title exactly matches the issue and PR body includes `Closes #...`
- required CI/security checks pass before merge

---

## Stop Conditions

STOP if a change would:
- introduce complex scheduling behavior beyond the issue
- break the 3-step flow
- add unnecessary user friction
- weaken system truth
- change persistence/auth/payment behavior without an issue
- create drift between docs and actual product behavior
- require bypassing CI/security, exposing secrets, or using a production database for local testing
- violate the one-issue/one-branch/one-concern scope or the explicit-staging rule
