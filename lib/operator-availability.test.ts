import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  isDateAvailable,
  isDateUnavailable,
  readOperatorAvailability,
  setOperatorDateAvailability,
  toOperatorAvailability,
} from "./operator-availability";

async function createStorePath() {
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-availability-"));

  return path.join(directory, "operator-availability.json");
}

test("returns empty operator availability when no store exists", async () => {
  const availability = await readOperatorAvailability(await createStorePath());

  assert.deepEqual(availability, {});
});

test("treats unconfigured dates as unavailable by default", () => {
  assert.equal(isDateUnavailable({}, "2026-07-01"), true);
  assert.equal(isDateAvailable({}, "2026-07-01"), false);
});

test("persists a blocked date across reads", async () => {
  const storePath = await createStorePath();

  await setOperatorDateAvailability("2026-06-14", "unavailable", storePath);

  const availability = await readOperatorAvailability(storePath);

  assert.equal(isDateUnavailable(availability, "2026-06-14"), true);
});

test("persists an explicitly available date", async () => {
  const storePath = await createStorePath();

  await setOperatorDateAvailability("2026-06-14", "unavailable", storePath);
  await setOperatorDateAvailability("2026-06-14", "available", storePath);

  const availability = await readOperatorAvailability(storePath);

  assert.equal(isDateUnavailable(availability, "2026-06-14"), false);
  assert.equal(isDateAvailable(availability, "2026-06-14"), true);
});

test("normalizes persisted availability dates", async () => {
  const storePath = await createStorePath();

  await writeFile(
    storePath,
    JSON.stringify({
      dates: {
        "bad-date": "available",
        "2026-06-14": "available",
        "2026-06-15": "unavailable",
        "2026-06-16": "bad-mode",
      },
    }),
    "utf8",
  );

  const availability = await readOperatorAvailability(storePath);

  assert.deepEqual(
    availability,
    toOperatorAvailability({
      "2026-06-14": "available",
      "2026-06-15": "unavailable",
    }),
  );
});

test("reads legacy blocked dates as unavailable dates", async () => {
  const storePath = await createStorePath();

  await writeFile(
    storePath,
    JSON.stringify({
      blockedDates: ["bad-date", "2026-06-14", "2026-06-14", 42],
    }),
    "utf8",
  );

  const availability = await readOperatorAvailability(storePath);

  assert.deepEqual(
    availability,
    toOperatorAvailability({ "2026-06-14": "unavailable" }),
  );
});
