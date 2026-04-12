import { isSlotAvailable } from "./reservations.ts";
import type { Slot } from "./slots.ts";

export function applyReservationAvailability(
  slots: Slot[],
  existingReservations: Slot[],
): Slot[] {
  return slots.map((slot) => ({
    ...slot,
    status: isSlotAvailable(slot, existingReservations)
      ? "available"
      : "unavailable",
  }));
}
