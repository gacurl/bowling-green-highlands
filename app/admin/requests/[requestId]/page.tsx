import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../../components/page-shell";
import { toReservationRequestDetailItem } from "../../../lib/reservation-request-detail";
import { readReservationRequests } from "../../../lib/reservation-requests";

type RequestDetailPageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function RequestDetailPage({
  params,
}: RequestDetailPageProps) {
  const { requestId } = await params;
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
            <dd>{requestDetail.status}</dd>
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
      </article>
    </PageShell>
  );
}
