import Link from "next/link";
import { PageShell } from "../components/page-shell";

type ConfirmationPageProps = {
  searchParams: Promise<{
    contactEmail?: string;
    guestName?: string;
    guestEmail?: string;
    submitted?: string;
    requestedDates?: string;
    requestNotes?: string;
  }>;
};

function readValue(value: string | undefined) {
  return value?.trim() ?? "";
}

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const params = await searchParams;
  const contactEmail = readValue(params.contactEmail);
  const guestName = readValue(params.guestName);
  const guestEmail = readValue(params.guestEmail);
  const requestedDates = readValue(params.requestedDates);
  const requestNotes = readValue(params.requestNotes);
  const hasRequestDetails = guestName && guestEmail && requestedDates;
  const submitted = params.submitted === "1";

  return (
    <PageShell
      eyebrow="Confirmation"
      title="Reservation request submitted for operator review."
      description={
        submitted && hasRequestDetails
          ? "Your request has been forwarded to the farm operator by email. They will review it and follow up directly. This does not confirm a booking."
          : "After you submit a reservation request, this page confirms that the operator will review it and follow up later. A request is not a confirmed booking."
      }
      children={
        submitted && hasRequestDetails ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <dl className="space-y-4 text-sm text-zinc-600">
              <div>
                <dt className="font-medium text-zinc-900">Name</dt>
                <dd>{guestName}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">Email</dt>
                <dd>{guestEmail}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">Requested dates</dt>
                <dd>{requestedDates}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">Notes</dt>
                <dd>{requestNotes || "None provided"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-900">Operator email</dt>
                <dd>{contactEmail || "Not configured"}</dd>
              </div>
            </dl>
          </div>
        ) : null
      }
      action={
        submitted && hasRequestDetails ? (
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
    />
  );
}
