import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../../components/page-shell";
import { toReservationRequestDetailItem } from "../../../lib/reservation-request-detail";
import { readReservationRequests } from "../../../lib/reservation-requests";

type RequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function RequestDetailPage({
  params,
  searchParams,
}: RequestDetailPageProps) {
  const { requestId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = resolvedSearchParams.error;
  const reservationRequests = await readReservationRequests();
  const requestDetail = toReservationRequestDetailItem(
    reservationRequests,
    requestId,
  );

  if (!requestDetail) {
    notFound();
  }

  return (
    <PageShell
      eyebrow="Operator Area"
      title="Reservation request"
      description="Read-only request details. This is not a confirmed booking."
      action={
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Back to admin
        </Link>
      }
    >
      <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <dl className="space-y-3 text-sm text-zinc-700">
          <div>
            <dt className="font-medium text-zinc-900">Submitted</dt>
            <dd>{requestDetail.createdAtLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Status</dt>
            <dd className="capitalize">{requestDetail.status}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Name</dt>
            <dd>{requestDetail.guestName}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Email</dt>
            <dd>{requestDetail.guestEmail}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Event type</dt>
            <dd>{requestDetail.eventTypeLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Requested date and time</dt>
            <dd>{requestDetail.requestedSlotLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Notes</dt>
            <dd>{requestDetail.requestNotes || "None provided"}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900">Request ID</dt>
            <dd>{requestDetail.id}</dd>
          </div>
        </dl>
        {error === "invalid_status" ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Invalid status update. Try again.
          </p>
        ) : null}
        {error === "invalid_transition" ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This request status is already set.
          </p>
        ) : null}
        {requestDetail.status === "pending" ? (
          <form
            action={`/admin/requests/${requestDetail.id}/status`}
            method="post"
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <button
              type="submit"
              name="status"
              value="accepted"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Accept request
            </button>
            <button
              type="submit"
              name="status"
              value="declined"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              Decline request
            </button>
          </form>
        ) : null}
      </article>
    </PageShell>
  );
}
