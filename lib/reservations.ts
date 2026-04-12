import type { Slot } from "./slots";

function isSameSlot(left: Slot, right: Slot): boolean {
  return (
    left.date === right.date &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime
  );
}

export function isSlotAvailable(
  slot: Slot,
  existingReservations: Slot[],
): boolean {
  return !existingReservations.some((existingReservation) =>
    isSameSlot(slot, existingReservation),
  );
}
