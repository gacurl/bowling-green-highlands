import Link from "next/link";
import { readOperatorAvailability } from "../../lib/operator-availability";
import { readReservationRequests } from "../lib/reservation-requests";
import { toReservationRequestListItems } from "../lib/reservation-request-list";
import {
  getReservationRequestStatusBadgeClass,
  getReservationRequestStatusLabel,
} from "../lib/reservation-request-status";
import { MonthCalendar } from "./month-calendar";
import { PageShell } from "../components/page-shell";

export default async function AdminPage() {
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const initialAvailability = await readOperatorAvailability();
  const reservationRequests = await readReservationRequests();
  const requestListItems = toReservationRequestListItems(reservationRequests);

  return (
    <PageShell
      eyebrow="Operator Area"
      title="Set date availability."
      description="Blocked is the default. Mark only dates guests may request."
      action={
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Return to landing
        </Link>
      }
    >
      <MonthCalendar
        initialAvailability={initialAvailability}
        todayIso={todayIso}
      />
      <details className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">
                Reservation requests
              </h2>
              <p className="text-sm text-zinc-600">
                Read-only submitted requests. Not confirmed bookings.
              </p>
            </div>
            <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
              {requestListItems.length}
            </span>
          </div>
        </summary>
        {requestListItems.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            No reservation requests submitted yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {requestListItems.map((requestListItem) => (
              <article
                key={requestListItem.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <dl className="space-y-2 text-sm text-zinc-700">
                  <div>
                    <dt className="font-medium text-zinc-900">Submitted</dt>
                    <dd>{requestListItem.createdAtLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getReservationRequestStatusBadgeClass(requestListItem.status)}`}
                      >
                        {getReservationRequestStatusLabel(requestListItem.status)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900">Name</dt>
                    <dd>{requestListItem.guestName}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900">Email</dt>
                    <dd>{requestListItem.guestEmail}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900">Event type</dt>
                    <dd>{requestListItem.eventTypeLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900">
                      Requested date and time
                    </dt>
                    <dd>{requestListItem.requestedSlotLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900">Notes</dt>
                    <dd>{requestListItem.requestNotes || "None provided"}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <Link
                    href={`/admin/requests/${requestListItem.id}`}
                    className="text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                  >
                    View request
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </details>
    </PageShell>
  );
}
