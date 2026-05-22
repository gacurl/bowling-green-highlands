import { formatRequestedSlotLabel } from "../../lib/requested-slot";
import { getEventTypeLabel } from "./event-type";
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
  requestNotes: string;
  requestedSlotLabel: string;
  status: ReservationRequestStatus;
};

export function toReservationRequestDetailItem(
  requests: ReservationRequestRecord[],
  requestId: string,
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
    requestNotes: request.requestNotes,
    requestedSlotLabel: formatRequestedSlotLabel(request.requestedDates),
    status: request.status,
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
