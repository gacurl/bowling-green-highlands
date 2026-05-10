import Link from "next/link";
import { cookies } from "next/headers";
import { PageShell } from "../components/page-shell";
import {
  CONFIRMATION_COOKIE_NAME,
  readConfirmationStateCookieValue,
} from "../lib/confirmation-state";

export default async function ConfirmationPage() {
  const cookieStore = await cookies();
  const confirmationState = readConfirmationStateCookieValue(
    cookieStore.get(CONFIRMATION_COOKIE_NAME)?.value,
    process.env.SMTP_URL,
  );
  const hasConfirmedRequest = confirmationState !== null;

  return (
    <PageShell
      eyebrow="Confirmation"
      title={
        hasConfirmedRequest
          ? "Reservation request submitted for operator review."
          : "No reservation request submitted yet."
      }
      description={
        hasConfirmedRequest
          ? "Your request has been forwarded to the farm operator by email. They will review it and follow up directly. This does not confirm a booking."
          : "Start a reservation request first. After it is sent, this page will confirm that the operator will review it and follow up later."
      }
      action={
        hasConfirmedRequest ? (
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Back to landing
          </Link>
        ) : (
          <Link
            href="/reserve"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Start a reservation request
          </Link>
        )
      }
    >
      {confirmationState ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <dl className="space-y-4 text-sm text-zinc-600">
            <div>
              <dt className="font-medium text-zinc-900">Name</dt>
              <dd>{confirmationState.guestName}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Email</dt>
              <dd>{confirmationState.guestEmail}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">
                Requested example slot
              </dt>
              <dd>{confirmationState.requestedDates}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Notes</dt>
              <dd>{confirmationState.requestNotes || "None provided"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Operator email</dt>
              <dd>{confirmationState.contactEmail || "Not configured"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </PageShell>
  );
}
