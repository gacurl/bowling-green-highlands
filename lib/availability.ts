const BLOCKED_DATES: string[] = [
  "2026-06-12",
  "2026-06-13",
];

function normalizeDate(input: string): string | null {
  if (!input) {
    return null;
  }

  const datePart = input.split("T")[0];
  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(datePart);

  return isValidFormat ? datePart : null;
}

export function isDateBlocked(date: string): boolean {
  const normalized = normalizeDate(date);

  if (!normalized) {
    return false;
  }

  return BLOCKED_DATES.includes(normalized);
}
