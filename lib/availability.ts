import { applyReservationAvailability } from "./slot-availability";
import {
  isDateAvailable,
  isOperatorAvailabilityDate,
  type OperatorAvailability,
} from "./operator-availability";
import { generateSlots, type Slot } from "./slots";

function normalizeDate(input: string): string | null {
  if (!input) {
    return null;
  }

  const datePart = input.split("T")[0];

  return isOperatorAvailabilityDate(datePart) ? datePart : null;
}

export function isDateBlocked(
  availability: OperatorAvailability,
  date: string,
): boolean {
  const normalized = normalizeDate(date);

  if (!normalized) {
    return true;
  }

  return !isDateAvailable(availability, normalized);
}

export function getAvailableSlots(
  date: string,
  startTime: string,
  endTime: string,
  existingReservations: Slot[],
  availability: OperatorAvailability = {},
): Slot[] {
  if (isDateBlocked(availability, date)) {
    return [];
  }

  const generatedSlots = generateSlots(date, startTime, endTime);

  return applyReservationAvailability(generatedSlots, existingReservations);
}
