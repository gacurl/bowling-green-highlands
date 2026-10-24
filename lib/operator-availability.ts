import {
  getDatabase,
  type DatabaseAccess,
  type DatabaseQueryable,
} from "./server/database";

export type OperatorAvailabilityMode = "available" | "unavailable";

export type OperatorDayAvailability = {
  mode: OperatorAvailabilityMode;
};

export type OperatorAvailability = Record<string, OperatorDayAvailability>;

type AvailabilityRow = {
  availability_date: string;
  mode: OperatorAvailabilityMode;
};

export const DEFAULT_OPERATOR_DAY_AVAILABILITY: OperatorDayAvailability = {
  mode: "unavailable",
};

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

async function readAvailabilityRows(database: DatabaseQueryable) {
  const result = await database.query<AvailabilityRow>(`
    SELECT availability_date::text AS availability_date, mode
    FROM operator_availability
    ORDER BY availability_date ASC
  `);

  return Object.fromEntries(
    result.rows.map((row) => [row.availability_date, { mode: row.mode }]),
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
  const normalizedAvailability = normalizeAvailabilityRecord(
    Object.fromEntries(
      Object.entries(availability).map(([date, dayAvailability]) => [
        date,
        dayAvailability.mode,
      ]),
    ),
  );

  await getDatabase(database).transaction(async (client) => {
    await client.query("DELETE FROM operator_availability");

    for (const [date, dayAvailability] of Object.entries(
      normalizedAvailability,
    )) {
      await client.query(
        `
          INSERT INTO operator_availability (availability_date, mode)
          VALUES ($1, $2)
        `,
        [date, dayAvailability.mode],
      );
    }
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

  return getDatabase(database).transaction(async (client) => {
    await client.query(
      `
        INSERT INTO operator_availability (availability_date, mode)
        VALUES ($1, $2)
        ON CONFLICT (availability_date) DO UPDATE
        SET mode = EXCLUDED.mode,
            updated_at = CURRENT_TIMESTAMP
      `,
      [date, mode],
    );

    return readAvailabilityRows(client);
  });
}
