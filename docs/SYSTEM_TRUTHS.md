# Bowling Green Highlands — System Truths

## Purpose

This document defines the immutable operational truths of the Bowling Green Highlands system.

These truths exist to prevent:

- feature drift
- booking-platform sprawl
- unnecessary complexity
- operator confusion
- misleading system behavior

If implementation convenience conflicts with these truths:

> the truths win.

---

# Product Identity

Bowling Green Highlands is:

> a lightweight operational reservation and availability system for a working farm.

It is NOT:

- a generic booking platform
- a full event-management system
- a CMS-first product
- an enterprise scheduling platform

---

# Core Operational Truths

## Reservations are request-based

Reservations are requests until explicitly accepted by the operator.

The system must never imply automatic booking confirmation unless true.
No payment or submit action may be treated as booking confirmation.

---

## Operators control availability

Operator-controlled availability is the source of truth.

Public availability must always derive from operator availability state.
Unconfigured dates are unavailable by default.

---

## Blocked dates cannot be requested

Dates marked unavailable must not appear selectable publicly.

Public users must never be able to request blocked dates.

---

## Availability truth stays explicit

Availability state must be explicit and operator-owned.

The UI and backend must never infer hidden availability from unrelated actions.

---

## Day-level simplicity is intentional

The MVP uses day-level availability only.

The system intentionally avoids:

- automatic slot-generation workflows
- recurring scheduling
- drag-and-drop calendars
- advanced scheduling rules
- booking-platform behavior that increases operator complexity

---

# UX Truths

## One primary action per screen

Every screen should make the next action obvious within seconds.

Avoid competing actions and unnecessary decisions.

---

## Simplicity is more important than feature depth

Prefer:

- fewer controls
- fewer words
- fewer states
- fewer decisions

The system should feel calm and understandable immediately.

---

## The system should not require instruction

Users should understand:

- availability
- reservation requests
- operator actions

without training or explanation.

---

## Operator speed matters more than feature richness

Operators should be able to:

- view availability
- block/unblock dates
- review requests

within seconds.

---

## The UI must not pretend

The interface must never imply behavior that does not actually exist.

Avoid:

- fake persistence
- misleading confirmation states
- unsupported workflow implications
- placeholder operational language in production flows
- auto-booking behavior when the system is request-based

---

# Architecture Truths

## Structured systems over flexible systems

Prefer:

- constrained workflows
- structured content
- controlled inputs
- predictable behavior

Avoid:

- arbitrary builders
- highly dynamic systems
- speculative abstractions

---

## Shared truth layers are required

Public availability, operator availability, and reservation integrity must derive from shared system truth.

Avoid duplicated availability logic.
Do not split truth between frontend assumptions and backend persistence.

---

## MVP-first development is mandatory

Build only what is necessary to prove operational value.

Avoid premature:

- dashboards
- analytics
- automation
- CMS expansion
- account systems
- enterprise workflows

---

# Workflow Truths

## Every issue must be atomic

Issues should:

- solve one problem
- have clear operational value
- avoid mixed concerns

---

## Working behavior is more important than architectural elegance

Definition of done:

- behavior works
- user flow is clear
- trust is preserved
- regressions are avoided

---

## Regression protection matters

Critical operational flows must be protected with tests before complexity expands.

Especially:

- availability
- reservation integrity
- payment verification
- conflict prevention

---

# Final Truth

If a feature increases:

- confusion
- cognitive load
- operator hesitation
- workflow friction
- maintenance burden

without significantly improving operational value:

> it should not be added.
