import assert from "node:assert/strict";
import test from "node:test";
import { createTestDatabase } from "./test-support/postgres-test-database";
import {
  isDateAvailable,
  isDateUnavailable,
  readOperatorAvailability,
  setOperatorDateAvailability,
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
        "UPDATE operator_availability SET mode = 'unavailable' WHERE availability_date = $1",
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
