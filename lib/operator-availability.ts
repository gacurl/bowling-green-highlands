import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type OperatorDayAvailability = {
  mode: "unavailable";
};

export type OperatorAvailability = Record<string, OperatorDayAvailability>;

type AvailabilityStoreFile = {
  blockedDates?: unknown;
};

const DEFAULT_BLOCKED_DATES = [
  "2026-04-10",
  "2026-04-18",
  "2026-05-21",
];

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

function normalizeBlockedDates(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && isOperatorAvailabilityDate(value),
      ),
    ),
  ).sort();
}

function toStoreFile(availability: OperatorAvailability): AvailabilityStoreFile {
  return {
    blockedDates: Object.entries(availability)
      .filter(([, dayAvailability]) => dayAvailability.mode === "unavailable")
      .map(([date]) => date)
      .sort(),
  };
}

export function toOperatorAvailability(
  blockedDates: string[],
): OperatorAvailability {
  return Object.fromEntries(
    normalizeBlockedDates(blockedDates).map((date) => [
      date,
      { mode: "unavailable" },
    ]),
  );
}

export function isDateUnavailable(
  availability: OperatorAvailability,
  date: string,
) {
  return availability[date]?.mode === "unavailable";
}

export async function readOperatorAvailability(
  storePath = getAvailabilityStorePath(),
): Promise<OperatorAvailability> {
  try {
    const fileContents = await readFile(storePath, "utf8");
    const parsedValue = JSON.parse(fileContents) as AvailabilityStoreFile;

    return toOperatorAvailability(normalizeBlockedDates(parsedValue.blockedDates));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return toOperatorAvailability(DEFAULT_BLOCKED_DATES);
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
  mode: "available" | "unavailable",
  storePath = getAvailabilityStorePath(),
) {
  if (!isOperatorAvailabilityDate(date)) {
    throw new Error("Invalid availability date");
  }

  const currentAvailability = await readOperatorAvailability(storePath);
  const nextAvailability = { ...currentAvailability };

  if (mode === "unavailable") {
    nextAvailability[date] = { mode: "unavailable" };
  } else {
    delete nextAvailability[date];
  }

  await writeOperatorAvailability(nextAvailability, storePath);

  return nextAvailability;
}
