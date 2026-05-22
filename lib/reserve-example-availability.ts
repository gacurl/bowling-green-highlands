import { getAvailableSlots } from "./availability";
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

function formatSlotValue(slot: Slot) {
  return `${slot.date} ${slot.startTime} to ${slot.endTime}`;
}

function parseSlotValue(slotValue: string) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) to (\d{2}:\d{2})$/.exec(
    slotValue,
  );

  if (!match) {
    return null;
  }

  return {
    date: match[1],
    startTime: match[2],
    endTime: match[3],
  };
}

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
  const parsedSlot = parseSlotValue(slotValue);

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
      formatSlotValue(slot) === slotValue,
  );
}
