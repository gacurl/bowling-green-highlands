import assert from "node:assert/strict";
import test from "node:test";
import { createTestDatabase } from "./test-support/postgres-test-database";
import {
  DEFAULT_OPERATOR_AVAILABILITY_DURATION_MINUTES,
  DEFAULT_OPERATOR_AVAILABILITY_START_MINUTE,
  getOperatorAvailabilityEndMinute,
  getOperatorDateAvailabilityWindow,
  isDateAvailable,
  isDateUnavailable,
  isOperatorAvailabilityWindow,
  readOperatorAvailability,
  setOperatorDateAvailability,
  setOperatorDateAvailabilityWindow,
  toOperatorAvailability,
} from "./operator-availability";

test("returns empty operator availability when no rows exist", async () => {
  const database = await createTestDatabase();
  assert.deepEqual(await readOperatorAvailability(database), {});
});

test("treats unconfigured dates as unavailable by default", () => {
  assert.equal(isDateUnavailable({}, "2026-07-01"), true);
  assert.equal(isDateAvailable({}, "2026-07-01"), false);
});

test("persists blocked and explicitly available dates", async () => {
  const database = await createTestDatabase();

  await setOperatorDateAvailability("2026-06-14", "unavailable", database);
  await setOperatorDateAvailability("2026-06-15", "available", database);

  assert.deepEqual(
    await readOperatorAvailability(database),
    toOperatorAvailability({
      "2026-06-14": "unavailable",
      "2026-06-15": "available",
    }),
  );
});

test("legacy available writes preserve the existing 09:00 to 11:00 window", async () => {
  const database = await createTestDatabase();

  await setOperatorDateAvailability("2026-06-14", "available", database);

  assert.deepEqual(await readOperatorAvailability(database), {
    "2026-06-14": {
      durationMinutes: DEFAULT_OPERATOR_AVAILABILITY_DURATION_MINUTES,
      mode: "available",
      startMinute: DEFAULT_OPERATOR_AVAILABILITY_START_MINUTE,
    },
  });
  assert.deepEqual(
    getOperatorDateAvailabilityWindow(
      await readOperatorAvailability(database),
      "2026-06-14",
    ),
    {
      durationMinutes: 120,
      endMinute: 660,
      startMinute: 540,
    },
  );
});

test("persists valid minimum and maximum availability windows", async () => {
  const database = await createTestDatabase();

  await setOperatorDateAvailabilityWindow(
    "2026-06-14",
    0,
    20,
    database,
  );
  await setOperatorDateAvailabilityWindow(
    "2026-06-15",
    16 * 60,
    8 * 60,
    database,
  );

  assert.deepEqual(await readOperatorAvailability(database), {
    "2026-06-14": {
      durationMinutes: 20,
      mode: "available",
      startMinute: 0,
    },
    "2026-06-15": {
      durationMinutes: 480,
      mode: "available",
      startMinute: 960,
    },
  });
  assert.equal(getOperatorAvailabilityEndMinute(960, 480), 1440);
});

test("rejects invalid duration and time boundaries without changing state", async () => {
  const database = await createTestDatabase();
  await setOperatorDateAvailabilityWindow(
    "2026-06-14",
    9 * 60,
    2 * 60,
    database,
  );

  for (const [startMinute, durationMinutes] of [
    [9 * 60, 0],
    [9 * 60, 15],
    [9 * 60, 30],
    [9 * 60, 500],
    [-1, 20],
    [24 * 60, 20],
    [20 * 60, 8 * 60],
  ]) {
    assert.equal(
      isOperatorAvailabilityWindow(startMinute, durationMinutes),
      false,
    );
    await assert.rejects(
      setOperatorDateAvailabilityWindow(
        "2026-06-14",
        startMinute,
        durationMinutes,
        database,
      ),
      /Invalid availability window/,
    );
  }

  assert.deepEqual(await readOperatorAvailability(database), {
    "2026-06-14": {
      durationMinutes: 120,
      mode: "available",
      startMinute: 540,
    },
  });
  assert.equal(getOperatorAvailabilityEndMinute(20 * 60, 8 * 60), null);
});

test("blocking an available date clears its configured window", async () => {
  const database = await createTestDatabase();

  await setOperatorDateAvailabilityWindow(
    "2026-06-14",
    10 * 60,
    80,
    database,
  );
  await setOperatorDateAvailability("2026-06-14", "unavailable", database);

  assert.deepEqual(await readOperatorAvailability(database), {
    "2026-06-14": { mode: "unavailable" },
  });
});

test("rejects invalid modes and calendar dates without changing state", async () => {
  const database = await createTestDatabase();
  await setOperatorDateAvailability("2026-06-14", "available", database);

  await assert.rejects(
    setOperatorDateAvailability("2026-06-14", "blocked" as never, database),
    /Invalid availability mode/,
  );
  await assert.rejects(
    setOperatorDateAvailability("2026-02-30", "unavailable", database),
    /Invalid availability date/,
  );
  assert.equal(
    isDateAvailable(await readOperatorAvailability(database), "2026-06-14"),
    true,
  );
});

test("concurrent updates to different dates do not overwrite each other", async () => {
  const database = await createTestDatabase();

  await Promise.all([
    setOperatorDateAvailability("2026-06-14", "available", database),
    setOperatorDateAvailability("2026-06-15", "unavailable", database),
  ]);

  assert.deepEqual(
    await readOperatorAvailability(database),
    toOperatorAvailability({
      "2026-06-14": "available",
      "2026-06-15": "unavailable",
    }),
  );
});

test("database transaction rollback preserves availability", async () => {
  const database = await createTestDatabase();
  await setOperatorDateAvailability("2026-06-14", "available", database);

  await assert.rejects(
    database.transaction(async (client) => {
      await client.query(
        `
          UPDATE operator_availability
          SET duration_minutes = NULL,
              mode = 'unavailable',
              start_minute = NULL
          WHERE availability_date = $1
        `,
        ["2026-06-14"],
      );
      throw new Error("rollback");
    }),
    /rollback/,
  );

  assert.equal(
    isDateAvailable(await readOperatorAvailability(database), "2026-06-14"),
    true,
  );
});
