export const SLOT_DURATION_MINUTES = 30;

export type Slot = {
  date: string;
  startTime: string;
  endTime: string;
  status: "available";
};

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

export function toMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function toTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function generateSlots(
  date: string,
  startTime: string,
  endTime: string,
): Slot[] {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return [];
  }

  if (startMinutes >= endMinutes) {
    return [];
  }

  const slots: Slot[] = [];
  let currentMinutes = startMinutes;

  while (currentMinutes + SLOT_DURATION_MINUTES <= endMinutes) {
    const nextMinutes = currentMinutes + SLOT_DURATION_MINUTES;

    slots.push({
      date,
      startTime: toTimeString(currentMinutes),
      endTime: toTimeString(nextMinutes),
      status: "available",
    });

    currentMinutes = nextMinutes;
  }

  return slots;
}
