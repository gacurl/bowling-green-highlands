import {
  getDatabase,
  type DatabaseAccess,
  type DatabaseQueryable,
} from "./server/database";

export type OperatorAvailabilityMode = "available" | "unavailable";

export type OperatorDayAvailability = {
  durationMinutes?: number;
  mode: OperatorAvailabilityMode;
  startMinute?: number;
};

export type OperatorAvailability = Record<string, OperatorDayAvailability>;

type AvailabilityRow = {
  availability_date: string;
  duration_minutes: number | null;
  mode: OperatorAvailabilityMode;
  start_minute: number | null;
};

export const DEFAULT_OPERATOR_DAY_AVAILABILITY: OperatorDayAvailability = {
  mode: "unavailable",
};

export const DEFAULT_OPERATOR_AVAILABILITY_START_MINUTE = 9 * 60;
export const DEFAULT_OPERATOR_AVAILABILITY_DURATION_MINUTES = 2 * 60;
export const MIN_OPERATOR_AVAILABILITY_DURATION_MINUTES = 20;
export const MAX_OPERATOR_AVAILABILITY_DURATION_MINUTES = 8 * 60;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isOperatorAvailabilityDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isOperatorAvailabilityMode(
  value: unknown,
): value is OperatorAvailabilityMode {
  return value === "available" || value === "unavailable";
}

export function isOperatorAvailabilityWindow(
  startMinute: number,
  durationMinutes: number,
) {
  return (
    Number.isInteger(startMinute) &&
    startMinute >= 0 &&
    startMinute < 24 * 60 &&
    Number.isInteger(durationMinutes) &&
    durationMinutes >= MIN_OPERATOR_AVAILABILITY_DURATION_MINUTES &&
    durationMinutes <= MAX_OPERATOR_AVAILABILITY_DURATION_MINUTES &&
    durationMinutes % MIN_OPERATOR_AVAILABILITY_DURATION_MINUTES === 0 &&
    startMinute + durationMinutes <= 24 * 60
  );
}

export function getOperatorAvailabilityEndMinute(
  startMinute: number,
  durationMinutes: number,
) {
  return isOperatorAvailabilityWindow(startMinute, durationMinutes)
    ? startMinute + durationMinutes
    : null;
}

function normalizeDayAvailability(
  value: unknown,
): OperatorDayAvailability | null {
  const objectValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const mode = typeof value === "string" ? value : objectValue?.mode;

  if (!isOperatorAvailabilityMode(mode)) {
    return null;
  }

  if (mode === "unavailable") {
    return { mode };
  }

  const hasStartMinute = objectValue?.startMinute !== undefined;
  const hasDurationMinutes = objectValue?.durationMinutes !== undefined;

  if (hasStartMinute !== hasDurationMinutes) {
    return null;
  }

  const startMinute = hasStartMinute
    ? objectValue?.startMinute
    : DEFAULT_OPERATOR_AVAILABILITY_START_MINUTE;
  const durationMinutes = hasDurationMinutes
    ? objectValue?.durationMinutes
    : DEFAULT_OPERATOR_AVAILABILITY_DURATION_MINUTES;

  if (
    typeof startMinute !== "number" ||
    typeof durationMinutes !== "number" ||
    !isOperatorAvailabilityWindow(startMinute, durationMinutes)
  ) {
    return null;
  }

  return {
    durationMinutes,
    mode,
    startMinute,
  };
}

function normalizeAvailabilityRecord(values: unknown): OperatorAvailability {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values)
      .map(([date, value]) => [date, normalizeDayAvailability(value)] as const)
      .filter(
        (entry): entry is readonly [string, OperatorDayAvailability] =>
          isOperatorAvailabilityDate(entry[0]) && entry[1] !== null,
      )
      .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
  );
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

export function getOperatorDateAvailabilityWindow(
  availability: OperatorAvailability,
  date: string,
) {
  const dayAvailability = normalizeDayAvailability(
    getOperatorDateAvailability(availability, date),
  );

  if (!dayAvailability || dayAvailability.mode !== "available") {
    return null;
  }

  return {
    durationMinutes: dayAvailability.durationMinutes!,
    endMinute:
      dayAvailability.startMinute! + dayAvailability.durationMinutes!,
    startMinute: dayAvailability.startMinute!,
  };
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

async function readAvailabilityRows(database: DatabaseQueryable) {
  const result = await database.query<AvailabilityRow>(`
    SELECT
      availability_date::text AS availability_date,
      duration_minutes,
      mode,
      start_minute
    FROM operator_availability
    ORDER BY availability_date ASC
  `);

  return Object.fromEntries(
    result.rows.map((row) => {
      const dayAvailability = normalizeDayAvailability({
        durationMinutes: row.duration_minutes,
        mode: row.mode,
        startMinute: row.start_minute,
      });

      if (!dayAvailability) {
        throw new Error("Stored operator availability window is invalid");
      }

      return [row.availability_date, dayAvailability];
    }),
  );
}

export async function readOperatorAvailability(
  database?: DatabaseAccess,
): Promise<OperatorAvailability> {
  return readAvailabilityRows(getDatabase(database));
}

export async function writeOperatorAvailability(
  availability: OperatorAvailability,
  database?: DatabaseAccess,
) {
  const normalizedAvailability = normalizeAvailabilityRecord(availability);

  await getDatabase(database).transaction(async (client) => {
    await client.query("DELETE FROM operator_availability");

    for (const [date, dayAvailability] of Object.entries(
      normalizedAvailability,
    )) {
      await client.query(
        `
          INSERT INTO operator_availability (
            availability_date,
            duration_minutes,
            mode,
            start_minute
          )
          VALUES ($1, $2, $3, $4)
        `,
        [
          date,
          dayAvailability.durationMinutes ?? null,
          dayAvailability.mode,
          dayAvailability.startMinute ?? null,
        ],
      );
    }
  });
}

async function persistOperatorDateAvailability(
  date: string,
  dayAvailability: OperatorDayAvailability,
  database?: DatabaseAccess,
) {
  return getDatabase(database).transaction(async (client) => {
    await client.query(
      `
        INSERT INTO operator_availability (
          availability_date,
          duration_minutes,
          mode,
          start_minute
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (availability_date) DO UPDATE
        SET duration_minutes = EXCLUDED.duration_minutes,
            mode = EXCLUDED.mode,
            start_minute = EXCLUDED.start_minute,
            updated_at = CURRENT_TIMESTAMP
      `,
      [
        date,
        dayAvailability.durationMinutes ?? null,
        dayAvailability.mode,
        dayAvailability.startMinute ?? null,
      ],
    );

    return readAvailabilityRows(client);
  });
}

export async function setOperatorDateAvailability(
  date: string,
  mode: OperatorAvailabilityMode,
  database?: DatabaseAccess,
) {
  if (!isOperatorAvailabilityDate(date)) {
    throw new Error("Invalid availability date");
  }

  if (!isOperatorAvailabilityMode(mode)) {
    throw new Error("Invalid availability mode");
  }

  return persistOperatorDateAvailability(
    date,
    mode === "available"
      ? {
          durationMinutes: DEFAULT_OPERATOR_AVAILABILITY_DURATION_MINUTES,
          mode,
          startMinute: DEFAULT_OPERATOR_AVAILABILITY_START_MINUTE,
        }
      : { mode },
    database,
  );
}

export async function setOperatorDateAvailabilityWindow(
  date: string,
  startMinute: number,
  durationMinutes: number,
  database?: DatabaseAccess,
) {
  if (!isOperatorAvailabilityDate(date)) {
    throw new Error("Invalid availability date");
  }

  if (!isOperatorAvailabilityWindow(startMinute, durationMinutes)) {
    throw new Error("Invalid availability window");
  }

  return persistOperatorDateAvailability(
    date,
    {
      durationMinutes,
      mode: "available",
      startMinute,
    },
    database,
  );
}
