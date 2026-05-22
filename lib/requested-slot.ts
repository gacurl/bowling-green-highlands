import type { Slot } from "./slots";

type RequestedSlotValue = {
  date: string;
  endTime: string;
  startTime: string;
};

const REQUESTED_SLOT_PATTERN =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) to (\d{2}:\d{2})$/;

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export function formatRequestedSlotValue(slot: Pick<Slot, "date" | "startTime" | "endTime">) {
  return `${slot.date} ${slot.startTime} to ${slot.endTime}`;
}

export function parseRequestedSlotValue(
  requestedSlotValue: string,
): RequestedSlotValue | null {
  const match = REQUESTED_SLOT_PATTERN.exec(requestedSlotValue);

  if (!match) {
    return null;
  }

  const [, date, startTime, endTime] = match;

  if (!isIsoDate(date) || !isTime(startTime) || !isTime(endTime)) {
    return null;
  }

  return {
    date,
    endTime,
    startTime,
  };
}

export function formatRequestedSlotLabel(requestedSlotValue: string) {
  const parsedSlotValue = parseRequestedSlotValue(requestedSlotValue);

  if (!parsedSlotValue) {
    return requestedSlotValue;
  }

  const friendlyDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${parsedSlotValue.date}T00:00:00`));

  return `${friendlyDate}, ${parsedSlotValue.startTime} to ${parsedSlotValue.endTime}`;
}
