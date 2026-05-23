import type { ReservationRequestStatus } from "./reservation-requests";

export function getReservationRequestStatusLabel(
  status: ReservationRequestStatus,
): string {
  if (status === "pending") {
    return "Pending request";
  }

  if (status === "accepted") {
    return "Accepted request";
  }

  return "Declined request";
}

export function getReservationRequestStatusBadgeClass(
  status: ReservationRequestStatus,
): string {
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "accepted") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}
