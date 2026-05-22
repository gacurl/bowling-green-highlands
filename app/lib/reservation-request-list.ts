import { getEventTypeLabel } from "./event-type";
import {
  type ReservationRequestRecord,
  type ReservationRequestStatus,
} from "./reservation-requests";
import { formatRequestedSlotLabel } from "../../lib/requested-slot";

export type ReservationRequestListItem = {
  createdAtLabel: string;
  eventTypeLabel: string;
  guestEmail: string;
  guestName: string;
  id: string;
  requestNotes: string;
  requestedSlotLabel: string;
  status: ReservationRequestStatus;
};

export function toReservationRequestListItems(
  requests: ReservationRequestRecord[],
): ReservationRequestListItem[] {
  return [...requests]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((request) => ({
      createdAtLabel: formatCreatedAtLabel(request.createdAt),
      eventTypeLabel: getEventTypeLabel(request.eventType),
      guestEmail: request.guestEmail,
      guestName: request.guestName,
      id: request.id,
      requestNotes: request.requestNotes,
      requestedSlotLabel: formatRequestedSlotLabel(request.requestedDates),
      status: request.status,
    }));
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
