export const EVENT_TYPE_OPTIONS = [
  { value: "farm_stay", label: "Farm stay" },
  { value: "wedding", label: "Wedding" },
  { value: "retreat", label: "Retreat" },
  { value: "other", label: "Other" },
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_OPTIONS)[number]["value"];

const EVENT_TYPE_VALUES = new Set<EventTypeValue>(
  EVENT_TYPE_OPTIONS.map((option) => option.value),
);

export function normalizeEventType(value: string): EventTypeValue | null {
  const canonicalValue = value.trim().toLowerCase().replace(/\s+/g, "_");

  if (!EVENT_TYPE_VALUES.has(canonicalValue as EventTypeValue)) {
    return null;
  }

  return canonicalValue as EventTypeValue;
}

export function getEventTypeLabel(value: string): string {
  const normalizedValue = normalizeEventType(value);

  if (!normalizedValue) {
    return "Other";
  }

  return (
    EVENT_TYPE_OPTIONS.find((option) => option.value === normalizedValue)?.label ??
    "Other"
  );
}
