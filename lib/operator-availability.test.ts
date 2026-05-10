import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  isDateUnavailable,
  readOperatorAvailability,
  setOperatorDateAvailability,
  toOperatorAvailability,
} from "./operator-availability";

async function createStorePath() {
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-availability-"));

  return path.join(directory, "operator-availability.json");
}

test("loads default blocked dates when no store exists", async () => {
  const availability = await readOperatorAvailability(await createStorePath());

  assert.equal(isDateUnavailable(availability, "2026-04-10"), true);
  assert.equal(isDateUnavailable(availability, "2026-06-14"), false);
});

test("persists a blocked date across reads", async () => {
  const storePath = await createStorePath();

  await setOperatorDateAvailability("2026-06-14", "unavailable", storePath);

  const availability = await readOperatorAvailability(storePath);

  assert.equal(isDateUnavailable(availability, "2026-06-14"), true);
});

test("persists an available date by removing the blocked date", async () => {
  const storePath = await createStorePath();

  await setOperatorDateAvailability("2026-06-14", "unavailable", storePath);
  await setOperatorDateAvailability("2026-06-14", "available", storePath);

  const availability = await readOperatorAvailability(storePath);

  assert.equal(isDateUnavailable(availability, "2026-06-14"), false);
});

test("normalizes persisted blocked dates", async () => {
  const storePath = await createStorePath();

  await writeFile(
    storePath,
    JSON.stringify({
      blockedDates: ["bad-date", "2026-06-14", "2026-06-14", 42],
    }),
    "utf8",
  );

  const availability = await readOperatorAvailability(storePath);

  assert.deepEqual(availability, toOperatorAvailability(["2026-06-14"]));
});
