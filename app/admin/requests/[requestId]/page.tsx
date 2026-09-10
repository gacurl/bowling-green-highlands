import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "../../../components/page-shell";
import { getRequestStatusErrorMessage } from "../../../lib/operational-error-messages";
import { toReservationRequestDetailItem } from "../../../lib/reservation-request-detail";
import {
  getReservationRequestStatusBadgeClass,
  getReservationRequestStatusLabel,
} from "../../../lib/reservation-request-status";
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
  const errorMessage = getRequestStatusErrorMessage(resolvedSearchParams.error);
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
      description={
        requestDetail.status === "pending"
          ? "Review this pending request and choose one action."
          : "Request details. This request status is already set."
      }
      action={
        <div className="flex flex-wrap gap-3">
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#CFC3AE] bg-[#FDF8EF] px-6 py-3 text-sm font-medium text-[#2B2922] transition-colors hover:bg-[#F6F0E6] sm:w-auto"
            >
              Log out
            </button>
          </form>
          <Link
            href="/admin"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-medium text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
          >
            Back to admin
          </Link>
        </div>
      }
    >
      <article className="rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6">
        {requestDetail.status === "pending" ? (
          <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Needs action: accept or decline this request.
          </p>
        ) : null}
        <dl className="space-y-3 text-sm text-[#4F4B3F]">
          <div>
            <dt className="font-medium text-[#2B2922]">Submitted</dt>
            <dd>{requestDetail.createdAtLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Status</dt>
            <dd>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getReservationRequestStatusBadgeClass(requestDetail.status)}`}
              >
                {getReservationRequestStatusLabel(requestDetail.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Status updated</dt>
            <dd>{requestDetail.statusUpdatedAtLabel ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Name</dt>
            <dd>{requestDetail.guestName}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Email</dt>
            <dd>{requestDetail.guestEmail}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Event type</dt>
            <dd>{requestDetail.eventTypeLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Requested date and time</dt>
            <dd>{requestDetail.requestedSlotLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Notes</dt>
            <dd>{requestDetail.requestNotes || "None provided"}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#2B2922]">Request ID</dt>
            <dd>{requestDetail.id}</dd>
          </div>
        </dl>
        {errorMessage ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span className="block font-medium">{errorMessage.title}</span>
            <span>{errorMessage.body}</span>
          </p>
        ) : null}
        {requestDetail.publicPaymentPath ? (
          <div className="mt-6 rounded-2xl border border-[#CFC3AE] bg-[#F6F0E6] px-4 py-3 text-sm text-[#4F4B3F]">
            <p className="font-medium text-[#2B2922]">
              Send this payment link to the customer.
            </p>
            <Link
              href={requestDetail.publicPaymentPath}
              className="mt-2 inline-flex break-all font-semibold text-[#2F4A35] underline underline-offset-4"
            >
              {requestDetail.publicPaymentPath}
            </Link>
          </div>
        ) : null}
        {requestDetail.status === "pending" ? (
          <form
            action={`/admin/requests/${requestDetail.id}/status`}
            method="post"
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <button
              type="submit"
              name="status"
              value="accepted"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-5 py-2 text-sm font-medium text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
            >
              Accept request
            </button>
            <button
              type="submit"
              name="status"
              value="declined"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-stone-300 bg-stone-100 px-5 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-200 sm:w-auto"
            >
              Decline request
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-2xl border border-[#D8CDBA] bg-[#F6F0E6] px-4 py-3 text-sm text-[#4F4B3F]">
            No action needed. This request is already{" "}
            {getReservationRequestStatusLabel(requestDetail.status).toLowerCase()}
            .
          </p>
        )}
      </article>
    </PageShell>
  );
}
