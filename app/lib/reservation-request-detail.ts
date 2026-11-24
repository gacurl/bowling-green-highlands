import { formatRequestedSlotLabel } from "../../lib/requested-slot";
import type { CheckoutReadiness } from "./checkout-session";
import { getEventTypeLabel } from "./event-type";
import { getCanonicalPaymentPath } from "./payment-page-content";
import type {
  ReservationRequestRecord,
  ReservationRequestStatus,
} from "./reservation-requests";

export type ReservationRequestDetailItem = {
  canAccept: boolean;
  createdAtLabel: string;
  eventTypeLabel: string;
  guestEmail: string;
  guestName: string;
  id: string;
  maximumSessionDurationMinutes: number | null;
  paymentStatusLabel: "Paid" | "Unpaid";
  publicPaymentUrl: string | null;
  requestNotes: string;
  requiresDurationForAcceptance: boolean;
  requestedSlotLabel: string;
  sessionDurationLabel: string;
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

  const hasReliableSessionStart =
    request.sessionDate !== undefined &&
    request.sessionStartMinute !== undefined;
  const canAccept = request.status === "pending" && hasReliableSessionStart;

  return {
    canAccept,
    createdAtLabel: formatCreatedAtLabel(request.createdAt),
    eventTypeLabel: getEventTypeLabel(request.eventType),
    guestEmail: request.guestEmail,
    guestName: request.guestName,
    id: request.id,
    maximumSessionDurationMinutes:
      request.sessionStartMinute === undefined
        ? null
        : 24 * 60 - request.sessionStartMinute,
    paymentStatusLabel: request.paymentStatus === "paid" ? "Paid" : "Unpaid",
    publicPaymentUrl:
      request.status === "accepted" &&
      request.paymentStatus !== "paid" &&
      checkoutReadiness?.appOrigin.startsWith("https://")
        ? `${checkoutReadiness.appOrigin}${getCanonicalPaymentPath(request.id)}`
        : null,
    requestNotes: request.requestNotes,
    requiresDurationForAcceptance:
      canAccept && request.sessionDurationMinutes === undefined,
    requestedSlotLabel: formatRequestedSlotLabel(request.requestedDates),
    sessionDurationLabel:
      request.sessionDurationMinutes === undefined
        ? "Not recorded"
        : formatSessionDurationLabel(request.sessionDurationMinutes),
    status: request.status,
    statusUpdatedAtLabel: request.statusUpdatedAt
      ? formatCreatedAtLabel(request.statusUpdatedAt)
      : null,
  };
}

function formatSessionDurationLabel(durationMinutes: number) {
  return `${durationMinutes} ${durationMinutes === 1 ? "minute" : "minutes"}`;
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
