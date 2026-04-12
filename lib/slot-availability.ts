import { isSlotAvailable } from "./reservations";
import type { Slot } from "./slots";

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
