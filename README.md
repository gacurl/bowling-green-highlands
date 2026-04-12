# Bowling Green Highlands

Bowling Green Highlands is a reservation request system for a working farm.
It gives guests a simple way to send a reservation request and gives the farm
operator a defined email destination for reviewing those requests.

This project is for:
- guests who want to request a stay or event date
- farm operators who need a lightweight way to receive and review requests

This is a request system, not a booking platform. A submitted request is not a
confirmed booking.

## Current State

Right now the application supports a simple public flow:

`landing -> reserve -> confirmation`

What it does today:
- guests can open the public landing page
- guests can submit a reservation request from `/reserve`
- the app forwards the request server-side to `CONTACT_EMAIL`
- the confirmation page explains that the request was submitted for review
- the confirmation page makes clear that no booking has been confirmed

## MVP Scope

Current MVP scope:
- request-based reservation flow
- server-side email forwarding for submitted requests
- basic server-side validation for required request fields
- placeholder admin route for future operator workflows

What this does not do yet:
- no confirmed booking flow
- no payments
- no availability filtering or calendar controls
- no database or persistence layer
- no submission list or admin dashboard
- no auth system

## Planned Direction

The target system direction is slot-based:
- operators define availability windows
- the system auto-generates time slots
- slot duration defaults to 30 minutes unless ticketed otherwise
- users select one available slot
- reserved slots cannot be double-booked

This direction is not implemented yet. Until it is implemented, the live system
remains request-based and email-driven.

## Target Slot Model

This section defines the authoritative target slot-based model for MVP. It is a
specification for future implementation, not a description of current behavior.

### Slot Structure

Each slot has:
- `date`: `YYYY-MM-DD`
- `startTime`: `HH:mm`
- `endTime`: `HH:mm`
- `status`: `available | reserved | unavailable`

### Slot Generation

For a given date:
- the operator defines a start time and end time
- the system generates slots automatically inside that availability window
- default slot duration is 30 minutes
- slot duration is configurable globally for MVP
- slots must not overlap
- slots must not extend past the operator-defined end time

### Slot Engine Requirements

This section defines the target slot engine contract for MVP. It is not live
behavior yet.

#### Engine Inputs

The engine takes:
- `date`: `YYYY-MM-DD`
- `startTime`: `HH:mm`
- `endTime`: `HH:mm`
- `slotDurationMinutes`: whole number of minutes

#### Engine Output

The engine returns:
- an ordered list of slot objects

Each slot object includes:
- `date`
- `startTime`
- `endTime`
- `status`

Newly generated slots default to:
- `status: available`

#### Generation Rules

- slots are generated sequentially from `startTime` toward `endTime`
- each slot uses the same slot duration
- no slot may extend past `endTime`
- no slots may overlap
- output order must always be deterministic
- partial trailing time that cannot fit a full slot does not create a slot

#### Validation And Boundary Rules

- `startTime` must be earlier than `endTime`
- malformed `date` input is invalid
- malformed time input is invalid
- zero-length windows are invalid
- negative windows are invalid
- invalid input must fail safely

For MVP, fail safely means:
- return an empty array (`[]`)
- do not generate partial or guessed slots

#### Format Standards

- `date` format is `YYYY-MM-DD`
- time format is `HH:mm`
- time handling stays simple
- no timezone logic is part of the engine

#### MVP Constraints

The slot engine does not include:
- recurrence
- multi-day windows
- drag/drop scheduling
- advanced calendar behavior
- persistence decisions

### Reservation Rules

Target reservation behavior:
- one reservation per slot
- a reserved slot is no longer selectable
- slots cannot be double-booked
- confirmation should reflect the actual reservation state

Current implementation note:
- the live app does not implement slot reservations yet
- the live app is still request-based and email-driven

### Operator Workflow

Target operator workflow:
- operator selects a date
- operator defines start and end availability
- system generates slots automatically
- operator may mark specific slots unavailable if needed
- workflow should stay simple and low-click

### Public User Workflow

Target public workflow:
- user visits the reserve page
- user sees available slots
- user selects one slot
- user submits the reservation
- confirmation reflects the actual reservation state

### Non-Goals For MVP

The target slot model does not include:
- recurring rules
- drag/drop calendar behavior
- complex scheduling tools
- payment workflow details
- advanced booking engine behavior

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env.local
```

3. Update `.env.local` with local values.

4. Start the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Environment Variables

The app currently expects these variables in `.env.local`:

- `NEXT_PUBLIC_APP_URL`
  Public base URL for local development and future links.
  Example: `http://127.0.0.1:3000`
- `CONTACT_EMAIL`
  Operator email address that receives reservation requests.
  Example: `hello@example.com`
- `SMTP_URL`
  SMTP connection string used for server-side email forwarding.
  Example: `smtp://localhost:1025`
- `EMAIL_FROM`
  Sender identity used when the app forwards reservation requests.
  Example: `reservations@example.com`

See [.env.example](/Users/gacurl/IdeaProjects/bowling-green-highlands/.env.example)
for the current starter values.

## Routes

- `/`
  Landing page for the public reservation request flow.
- `/reserve`
  Single-step reservation request form.
- `/confirmation`
  Confirmation page that explains the request was submitted for operator review.
- `/admin`
  Placeholder route for future operator-side workflows.

## Development Notes

- The app uses Next.js App Router with TypeScript, ESLint, and Tailwind CSS.
- Reservation requests are forwarded by the app on the server using SMTP.
- If validation fails or email delivery fails, the user is returned to
  `/reserve?error=1` with a plain recovery message.
