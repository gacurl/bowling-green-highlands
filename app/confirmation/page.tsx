import Link from "next/link";
import { cookies } from "next/headers";
import { formatRequestedSlotLabel } from "../../lib/requested-slot";
import { PageShell } from "../components/page-shell";
import { getEventTypeLabel } from "../lib/event-type";
import {
  CONFIRMATION_COOKIE_NAME,
  getConfirmationCookieSecret,
  readConfirmationStateCookieValue,
} from "../lib/confirmation-state";

export default async function ConfirmationPage() {
  const cookieStore = await cookies();
  const confirmationState = readConfirmationStateCookieValue(
    cookieStore.get(CONFIRMATION_COOKIE_NAME)?.value,
    getConfirmationCookieSecret(),
  );
  const hasConfirmedRequest = confirmationState !== null;

  return (
    <PageShell
      eyebrow="Confirmation"
      title={
        hasConfirmedRequest
          ? "Request received."
          : "No reservation request submitted yet."
      }
      description={
        hasConfirmedRequest
          ? "Your request was received. We’ll follow up to confirm."
          : "Start a reservation request first."
      }
      action={
        hasConfirmedRequest ? (
          <Link
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
          >
            Back to landing
          </Link>
        ) : (
          <Link
            href="/reserve"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#E5BA41] px-6 py-3 text-sm font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white sm:w-auto"
          >
            Start a reservation request
          </Link>
        )
      }
    >
      {confirmationState ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
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
              <dt className="font-medium text-zinc-900">Event type</dt>
              <dd>{getEventTypeLabel(confirmationState.eventType)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Requested date and time</dt>
              <dd>{formatRequestedSlotLabel(confirmationState.requestedDates)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Notes</dt>
              <dd>{confirmationState.requestNotes || "None provided"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Contact email</dt>
              <dd>{confirmationState.contactEmail || "Not configured"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </PageShell>
  );
}
