import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  getReserveExampleSlots,
  isReserveExampleSlotValue,
  RESERVE_EXAMPLE_DATE,
} from "./reserve-example-availability";
import { setOperatorDateAvailability } from "./operator-availability";

async function withAvailabilityStore<T>(runTest: (storePath: string) => Promise<T>) {
  const previousStorePath = process.env.BGH_AVAILABILITY_STORE_PATH;
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-reserve-"));
  const storePath = path.join(directory, "operator-availability.json");

  process.env.BGH_AVAILABILITY_STORE_PATH = storePath;

  try {
    return await runTest(storePath);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BGH_AVAILABILITY_STORE_PATH;
    } else {
      process.env.BGH_AVAILABILITY_STORE_PATH = previousStorePath;
    }
  }
}

test("returns no public slots when the example date is blocked", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability(
      RESERVE_EXAMPLE_DATE,
      "unavailable",
      storePath,
    );

    assert.deepEqual(await getReserveExampleSlots(), []);
  });
});

test("rejects example slot values when the example date is blocked", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability(
      RESERVE_EXAMPLE_DATE,
      "unavailable",
      storePath,
    );

    assert.equal(
      await isReserveExampleSlotValue(`${RESERVE_EXAMPLE_DATE} 09:00 to 09:30`),
      false,
    );
  });
});
