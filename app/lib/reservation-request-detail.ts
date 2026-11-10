import { formatRequestedSlotLabel } from "../../lib/requested-slot";
import type { CheckoutReadiness } from "./checkout-session";
import { getEventTypeLabel } from "./event-type";
import { getCanonicalPaymentPath } from "./payment-page-content";
import type {
  ReservationRequestRecord,
  ReservationRequestStatus,
} from "./reservation-requests";

export type ReservationRequestDetailItem = {
  createdAtLabel: string;
  eventTypeLabel: string;
  guestEmail: string;
  guestName: string;
  id: string;
  paymentStatusLabel: "Paid" | "Unpaid";
  publicPaymentUrl: string | null;
  requestNotes: string;
  requestedSlotLabel: string;
  status: ReservationRequestStatus;
  statusUpdatedAtLabel: string | null;
};

export function toReservationRequestDetailItem(
  requests: ReservationRequestRecord[],
  requestId: string,
  checkoutReadiness: CheckoutReadiness | null = null,
): ReservationRequestDetailItem | null {
  const request = requests.find((record) => record.id === requestId);

  if (!request) {
    return null;
  }

  return {
    createdAtLabel: formatCreatedAtLabel(request.createdAt),
    eventTypeLabel: getEventTypeLabel(request.eventType),
    guestEmail: request.guestEmail,
    guestName: request.guestName,
    id: request.id,
    paymentStatusLabel: request.paymentStatus === "paid" ? "Paid" : "Unpaid",
    publicPaymentUrl:
      request.status === "accepted" &&
      request.paymentStatus !== "paid" &&
      checkoutReadiness?.appOrigin.startsWith("https://")
        ? `${checkoutReadiness.appOrigin}${getCanonicalPaymentPath(request.id)}`
        : null,
    requestNotes: request.requestNotes,
    requestedSlotLabel: formatRequestedSlotLabel(request.requestedDates),
    status: request.status,
    statusUpdatedAtLabel: request.statusUpdatedAt
      ? formatCreatedAtLabel(request.statusUpdatedAt)
      : null,
  };
}

function formatCreatedAtLabel(createdAt: string) {
  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}
