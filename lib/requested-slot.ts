import { toMinutes, type Slot } from "./slots";
import { isOperatorAvailabilityDate } from "./operator-availability";

type RequestedSlotValue = {
  date: string;
  endTime?: string;
  startTime: string;
};

export type ReservationSessionInterval = {
  date: string;
  durationMinutes: number | null;
  startMinute: number;
};

const REQUESTED_SLOT_PATTERN =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?: to (\d{2}:\d{2}))?$/;
const MINUTES_PER_DAY = 24 * 60;

function isIsoDate(value: string) {
  return isOperatorAvailabilityDate(value);
}

function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function formatFarmLocalTime(time: string) {
  const [hourValue, minute] = time.split(":");
  const hour = Number(hourValue);
  const hourLabel = hour % 12 || 12;
  const meridiem = hour < 12 ? "AM" : "PM";

  return `${hourLabel}:${minute} ${meridiem}`;
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

  if (
    !isIsoDate(date) ||
    !isTime(startTime) ||
    (endTime !== undefined && !isTime(endTime))
  ) {
    return null;
  }

  const parsedValue: RequestedSlotValue = {
    date,
    startTime,
  };

  if (endTime !== undefined) {
    parsedValue.endTime = endTime;
  }

  return parsedValue;
}

export function deriveReservationSessionInterval(
  requestedSlotValue: string,
): ReservationSessionInterval | null {
  const requestedSlot = parseRequestedSlotValue(requestedSlotValue);

  if (!requestedSlot) {
    return null;
  }

  const startMinute = toMinutes(requestedSlot.startTime);

  if (startMinute === null) {
    return null;
  }

  if (requestedSlot.endTime === undefined) {
    return {
      date: requestedSlot.date,
      durationMinutes: null,
      startMinute,
    };
  }

  const endMinute = toMinutes(requestedSlot.endTime);

  if (endMinute === null || endMinute <= startMinute) {
    return null;
  }

  const durationMinutes = endMinute - startMinute;

  if (startMinute + durationMinutes > MINUTES_PER_DAY) {
    return null;
  }

  return {
    date: requestedSlot.date,
    durationMinutes,
    startMinute,
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
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${parsedSlotValue.date}T00:00:00Z`));

  const timeLabel = parsedSlotValue.endTime
    ? `${formatFarmLocalTime(parsedSlotValue.startTime)} to ${formatFarmLocalTime(parsedSlotValue.endTime)}`
    : formatFarmLocalTime(parsedSlotValue.startTime);

  return `${friendlyDate} at ${timeLabel} Eastern Time`;
}
