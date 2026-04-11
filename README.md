# Bowling Green Highlands

Bowling Green Highlands is a reservation request system for a working farm.
It gives guests a simple way to send a reservation request and gives the farm
operator a defined email destination for reviewing those requests.

This project is for:
- guests who want to request a stay or event date
- farm operators who need a lightweight way to receive and review requests

This is a request system, not a booking platform. A submitted request is not a
confirmed booking.

## Current Behavior

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
