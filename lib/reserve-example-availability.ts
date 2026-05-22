import { getAvailableSlots } from "./availability";
import {
  formatRequestedSlotValue,
  parseRequestedSlotValue,
} from "./requested-slot";
import { readOperatorAvailability } from "./operator-availability";
import type { Slot } from "./slots";

export const RESERVE_EXAMPLE_START_TIME = "09:00";
export const RESERVE_EXAMPLE_END_TIME = "11:00";
export const RESERVE_EXAMPLE_DATE = "2026-06-14";

const EXISTING_RESERVATIONS: Slot[] = [
  {
    date: RESERVE_EXAMPLE_DATE,
    startTime: "09:30",
    endTime: "10:00",
    status: "available",
  },
];

export async function getReserveExampleSlots() {
  const operatorAvailability = await readOperatorAvailability();
  const availableDates = Object.entries(operatorAvailability)
    .filter(([, dayAvailability]) => dayAvailability.mode === "available")
    .map(([date]) => date)
    .sort((firstDate, secondDate) => firstDate.localeCompare(secondDate));

  return availableDates.flatMap((date) =>
    getAvailableSlots(
      date,
      RESERVE_EXAMPLE_START_TIME,
      RESERVE_EXAMPLE_END_TIME,
      EXISTING_RESERVATIONS,
      operatorAvailability,
    ),
  );
}

export async function isReserveExampleSlotValue(slotValue: string) {
  const parsedSlot = parseRequestedSlotValue(slotValue);

  if (!parsedSlot) {
    return false;
  }

  const slots = await getReserveExampleSlots();

  return slots.some(
    (slot) =>
      slot.status === "available" &&
      slot.date === parsedSlot.date &&
      slot.startTime === parsedSlot.startTime &&
      slot.endTime === parsedSlot.endTime &&
      formatRequestedSlotValue(slot) === slotValue,
  );
}
