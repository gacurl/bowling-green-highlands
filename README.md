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

Milestone 2 status: complete.

What it does today:
- guests can open the public landing page
- guests can submit a reservation request from `/reserve`
- the app forwards the request server-side to `CONTACT_EMAIL`
- the confirmation page explains that the request was submitted for review
- the confirmation page makes clear that no booking has been confirmed
- operators can manage day-level availability from `/admin`
- public request options are filtered by operator availability

## MVP Scope

Current MVP scope:
- request-based reservation flow
- server-side email forwarding for submitted requests
- basic server-side validation for required request fields
- operator day-level availability controls

What this does not do yet:
- no confirmed booking flow
- no payments
- no database-backed persistence layer
- no submission list or admin dashboard
- no public account system

## Operator Availability Persistence (Current MVP)

Operator availability is stored in a local JSON file:
- default path: `data/operator-availability.json`
- override path: `BGH_AVAILABILITY_STORE_PATH`

This is intentionally MVP-local friendly:
- simple to run locally
- easy to inspect
- low operational overhead for current scope

Known limits:
- not ideal for read-only serverless filesystems
- concurrent writes are last-write-wins
- invalid/corrupt JSON fails loudly at read time

Practical note:
- this is acceptable for the current MVP phase
- future growth may require moving availability persistence to a multi-writer-safe store, but that migration is out of scope for now

## Planned Direction

Near-term direction (Milestone 3):
- keep reservation flow request-based
- preserve operator-controlled day-level availability truth
- expand public availability presentation beyond the current fixed example-day context
- keep the operator workflow simple and low-cognitive-load

Out of scope for Milestone 3:
- payments
- auto-booking
- recurring scheduling
- drag/drop calendars
- booking-platform behavior

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
- `ADMIN_PASSWORD`
  Password required for admin session access to `/admin` routes.
  Example: `change-this-admin-password`

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
  Operator day-level availability calendar (requires admin login).
- `/admin/login`
  Admin login screen used to establish the operator session.

## Development Notes

- The app uses Next.js App Router with TypeScript, ESLint, and Tailwind CSS.
- Reservation requests are forwarded by the app on the server using SMTP.
- If validation fails or email delivery fails, the user is returned to
  `/reserve?error=1` with a plain recovery message.

## Application Versioning

`package.json` is the authoritative application version source. Versions follow
Semantic Versioning:

- `PATCH`: backward-compatible fix
- `MINOR`: backward-compatible feature
- `MAJOR`: intentional incompatible product or system change

Release tags use `vX.Y.Z` and are created from the intended release commit on
`main`, not from an issue branch.

Production behavior changes include the appropriate Semantic Version bump in the
same issue before merge.
