import { getAvailableSlots } from "./availability";
import { readOperatorAvailability } from "./operator-availability";
import type { Slot } from "./slots";

export const RESERVE_EXAMPLE_DATE = "2026-06-14";
export const RESERVE_EXAMPLE_DATE_LABEL = "Sunday, June 14, 2026";
export const RESERVE_EXAMPLE_START_TIME = "09:00";
export const RESERVE_EXAMPLE_END_TIME = "11:00";

const EXISTING_RESERVATIONS: Slot[] = [
  {
    date: RESERVE_EXAMPLE_DATE,
    startTime: "09:30",
    endTime: "10:00",
    status: "available",
  },
];

function formatSlotValue(slot: Slot) {
  return `${slot.date} ${slot.startTime} to ${slot.endTime}`;
}

export async function getReserveExampleSlots() {
  const operatorAvailability = await readOperatorAvailability();

  return getAvailableSlots(
    RESERVE_EXAMPLE_DATE,
    RESERVE_EXAMPLE_START_TIME,
    RESERVE_EXAMPLE_END_TIME,
    EXISTING_RESERVATIONS,
    operatorAvailability,
  );
}

export async function isReserveExampleSlotValue(slotValue: string) {
  const slots = await getReserveExampleSlots();

  return slots.some(
    (slot) => slot.status === "available" && formatSlotValue(slot) === slotValue,
  );
}
