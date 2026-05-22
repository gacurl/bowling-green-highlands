import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type OperatorAvailabilityMode = "available" | "unavailable";

export type OperatorDayAvailability = {
  mode: OperatorAvailabilityMode;
};

export type OperatorAvailability = Record<string, OperatorDayAvailability>;

type AvailabilityStoreFile = {
  dates?: unknown;
  blockedDates?: unknown;
};

export const DEFAULT_OPERATOR_DAY_AVAILABILITY: OperatorDayAvailability = {
  mode: "unavailable",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getAvailabilityStorePath() {
  return (
    process.env.BGH_AVAILABILITY_STORE_PATH ??
    path.join(process.cwd(), "data", "operator-availability.json")
  );
}

export function isOperatorAvailabilityDate(value: string) {
  return DATE_PATTERN.test(value);
}

function isOperatorAvailabilityMode(
  value: unknown,
): value is OperatorAvailabilityMode {
  return value === "available" || value === "unavailable";
}

function normalizeAvailabilityRecord(values: unknown): OperatorAvailability {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values)
      .filter(
        ([date, mode]) =>
          isOperatorAvailabilityDate(date) && isOperatorAvailabilityMode(mode),
      )
      .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
      .map(([date, mode]) => [date, { mode }]),
  );
}

function normalizeLegacyBlockedDates(values: unknown): OperatorAvailability {
  if (!Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Array.from(
      new Set(
        values.filter(
          (value): value is string =>
            typeof value === "string" && isOperatorAvailabilityDate(value),
        ),
      ),
    )
      .sort()
      .map((date) => [date, { mode: "unavailable" }]),
  );
}

function toStoreFile(availability: OperatorAvailability): AvailabilityStoreFile {
  return {
    dates: Object.fromEntries(
      Object.entries(availability)
        .filter(([, dayAvailability]) =>
          isOperatorAvailabilityMode(dayAvailability.mode),
        )
        .sort(([firstDate], [secondDate]) =>
          firstDate.localeCompare(secondDate),
        )
        .map(([date, dayAvailability]) => [date, dayAvailability.mode]),
    ),
  };
}

export function toOperatorAvailability(
  dates: Record<string, OperatorAvailabilityMode>,
): OperatorAvailability {
  return normalizeAvailabilityRecord(dates);
}

export function getOperatorDateAvailability(
  availability: OperatorAvailability,
  date: string,
): OperatorDayAvailability {
  return availability[date] ?? DEFAULT_OPERATOR_DAY_AVAILABILITY;
}

export function isDateAvailable(
  availability: OperatorAvailability,
  date: string,
) {
  return getOperatorDateAvailability(availability, date).mode === "available";
}

export function isDateUnavailable(
  availability: OperatorAvailability,
  date: string,
) {
  return getOperatorDateAvailability(availability, date).mode === "unavailable";
}

export async function readOperatorAvailability(
  storePath = getAvailabilityStorePath(),
): Promise<OperatorAvailability> {
  try {
    const fileContents = await readFile(storePath, "utf8");
    const parsedValue = JSON.parse(fileContents) as AvailabilityStoreFile;
    const availability = normalizeAvailabilityRecord(parsedValue.dates);

    if (Object.keys(availability).length > 0) {
      return availability;
    }

    return normalizeLegacyBlockedDates(parsedValue.blockedDates);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

export async function writeOperatorAvailability(
  availability: OperatorAvailability,
  storePath = getAvailabilityStorePath(),
) {
  const directory = path.dirname(storePath);
  const temporaryPath = `${storePath}.tmp`;
  const serializedStore = `${JSON.stringify(toStoreFile(availability), null, 2)}\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, serializedStore, "utf8");
  await rename(temporaryPath, storePath);
}

export async function setOperatorDateAvailability(
  date: string,
  mode: OperatorAvailabilityMode,
  storePath = getAvailabilityStorePath(),
) {
  if (!isOperatorAvailabilityDate(date)) {
    throw new Error("Invalid availability date");
  }

  const currentAvailability = await readOperatorAvailability(storePath);
  const nextAvailability = { ...currentAvailability };

  nextAvailability[date] = { mode };

  await writeOperatorAvailability(nextAvailability, storePath);

  return nextAvailability;
}
