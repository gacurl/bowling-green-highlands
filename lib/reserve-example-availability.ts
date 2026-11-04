import { readReservationRequests } from "../app/lib/reservation-requests";
import { getAvailableSlots } from "./availability";
import {
  getOperatorDateAvailabilityWindow,
  isOperatorAvailabilityDate,
  readOperatorAvailability,
} from "./operator-availability";
import { parseRequestedSlotValue } from "./requested-slot";
import { toMinutes, toTimeString } from "./slots";
import type { Slot } from "./slots";

export const PREFERRED_TIME_INCREMENT_MINUTES = 15;
export const RESERVE_EXAMPLE_DATE = "2026-06-14";

export type ReserveDateOption = {
  date: string;
  endMinute: number;
  startMinute: number;
};

export async function getReserveDateOptions(): Promise<ReserveDateOption[]> {
  const operatorAvailability = await readOperatorAvailability();

  return Object.keys(operatorAvailability)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate))
    .flatMap((date) => {
      const window = getOperatorDateAvailabilityWindow(
        operatorAvailability,
        date,
      );

      return window
        ? [
            {
              date,
              endMinute: window.endMinute,
              startMinute: window.startMinute,
            },
          ]
        : [];
    });
}

// Retain the legacy payment-regression seam without using generated slots in
// the public reservation flow. Its windows and reservations remain data-driven.
export async function getReserveExampleSlots() {
  const [operatorAvailability, reservationRequests] = await Promise.all([
    readOperatorAvailability(),
    readReservationRequests(),
  ]);
  const acceptedSlots: Slot[] = reservationRequests.flatMap((requestRecord) => {
    const requestedSlot = parseRequestedSlotValue(requestRecord.requestedDates);

    return requestRecord.status === "accepted" && requestedSlot?.endTime
      ? [
          {
            date: requestedSlot.date,
            endTime: requestedSlot.endTime,
            startTime: requestedSlot.startTime,
            status: "available" as const,
          },
        ]
      : [];
  });

  return Object.keys(operatorAvailability)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate))
    .flatMap((date) => {
      const window = getOperatorDateAvailabilityWindow(
        operatorAvailability,
        date,
      );

      return window
        ? getAvailableSlots(
            date,
            toTimeString(window.startMinute),
            toTimeString(window.endMinute),
            acceptedSlots,
            operatorAvailability,
          )
        : [];
    });
}

export async function validatePreferredTimeRequest(
  requestedDate: string,
  preferredTime: string,
): Promise<string | null> {
  if (!isOperatorAvailabilityDate(requestedDate)) {
    return null;
  }

  const preferredMinute = toMinutes(preferredTime);

  if (
    preferredMinute === null ||
    toTimeString(preferredMinute) !== preferredTime ||
    preferredMinute % PREFERRED_TIME_INCREMENT_MINUTES !== 0
  ) {
    return null;
  }

  const [operatorAvailability, reservationRequests] = await Promise.all([
    readOperatorAvailability(),
    readReservationRequests(),
  ]);
  const window = getOperatorDateAvailabilityWindow(
    operatorAvailability,
    requestedDate,
  );

  if (
    !window ||
    preferredMinute < window.startMinute ||
    preferredMinute >= window.endMinute
  ) {
    return null;
  }

  const hasAcceptedConflict = reservationRequests.some((requestRecord) => {
    if (requestRecord.status !== "accepted") {
      return false;
    }

    const requestedSlot = parseRequestedSlotValue(requestRecord.requestedDates);

    return (
      requestedSlot?.date === requestedDate &&
      requestedSlot.startTime === preferredTime
    );
  });

  return hasAcceptedConflict ? null : `${requestedDate} ${preferredTime}`;
}
