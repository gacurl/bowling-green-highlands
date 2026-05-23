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
import {
  createReservationRequestRecord,
  updateReservationRequestStatus,
} from "../app/lib/reservation-requests";

async function withAvailabilityStore<T>(runTest: (storePath: string) => Promise<T>) {
  const previousStorePath = process.env.BGH_AVAILABILITY_STORE_PATH;
  const previousRequestStorePath = process.env.BGH_RESERVATION_REQUESTS_STORE_PATH;
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-reserve-"));
  const storePath = path.join(directory, "operator-availability.json");
  const requestStorePath = path.join(directory, "reservation-requests.json");

  process.env.BGH_AVAILABILITY_STORE_PATH = storePath;
  process.env.BGH_RESERVATION_REQUESTS_STORE_PATH = requestStorePath;

  try {
    return await runTest(storePath);
  } finally {
    if (previousStorePath === undefined) {
      delete process.env.BGH_AVAILABILITY_STORE_PATH;
    } else {
      process.env.BGH_AVAILABILITY_STORE_PATH = previousStorePath;
    }

    if (previousRequestStorePath === undefined) {
      delete process.env.BGH_RESERVATION_REQUESTS_STORE_PATH;
    } else {
      process.env.BGH_RESERVATION_REQUESTS_STORE_PATH = previousRequestStorePath;
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

test("returns no public slots when the example date is unconfigured", async () => {
  await withAvailabilityStore(async () => {
    assert.deepEqual(await getReserveExampleSlots(), []);
  });
});

test("returns public slots only after operator opens the example date", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available", storePath);

    const slots = await getReserveExampleSlots();

    assert.ok(slots.some((slot) => slot.status === "available"));
  });
});

test("returns slots for multiple available dates", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability("2026-06-14", "available", storePath);
    await setOperatorDateAvailability("2026-06-15", "available", storePath);

    const slots = await getReserveExampleSlots();
    const dates = Array.from(new Set(slots.map((slot) => slot.date)));

    assert.deepEqual(dates, ["2026-06-14", "2026-06-15"]);
    assert.ok(slots.some((slot) => slot.status === "available"));
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

test("rejects malformed slot value formats", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available", storePath);

    assert.equal(
      await isReserveExampleSlotValue(`${RESERVE_EXAMPLE_DATE} 9:00 to 09:30`),
      false,
    );
    assert.equal(
      await isReserveExampleSlotValue(`${RESERVE_EXAMPLE_DATE}T09:00 to 09:30`),
      false,
    );
    assert.equal(await isReserveExampleSlotValue("bad-value"), false);
  });
});

test("excludes accepted request slots from public options", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available", storePath);
    const acceptedRequest = await createReservationRequestRecord({
      eventType: "farm_stay",
      guestEmail: "accepted@example.com",
      guestName: "Accepted Guest",
      requestNotes: "",
      requestedDates: `${RESERVE_EXAMPLE_DATE} 09:00 to 09:30`,
    });
    assert.equal(
      await updateReservationRequestStatus(acceptedRequest.id, "accepted"),
      "updated",
    );

    const slots = await getReserveExampleSlots();
    const removedSlot = slots.find(
      (slot) =>
        slot.date === RESERVE_EXAMPLE_DATE &&
        slot.startTime === "09:00" &&
        slot.endTime === "09:30",
    );

    assert.equal(removedSlot?.status, "unavailable");
    assert.equal(
      await isReserveExampleSlotValue(`${RESERVE_EXAMPLE_DATE} 09:00 to 09:30`),
      false,
    );
  });
});

test("pending and declined request slots remain public options", async () => {
  await withAvailabilityStore(async (storePath) => {
    await setOperatorDateAvailability(RESERVE_EXAMPLE_DATE, "available", storePath);
    await createReservationRequestRecord({
      eventType: "farm_stay",
      guestEmail: "pending@example.com",
      guestName: "Pending Guest",
      requestNotes: "",
      requestedDates: `${RESERVE_EXAMPLE_DATE} 10:00 to 10:30`,
    });
    const declinedRequest = await createReservationRequestRecord({
      eventType: "retreat",
      guestEmail: "declined@example.com",
      guestName: "Declined Guest",
      requestNotes: "",
      requestedDates: `${RESERVE_EXAMPLE_DATE} 10:30 to 11:00`,
    });
    assert.equal(
      await updateReservationRequestStatus(declinedRequest.id, "declined"),
      "updated",
    );

    assert.equal(
      await isReserveExampleSlotValue(`${RESERVE_EXAMPLE_DATE} 10:00 to 10:30`),
      true,
    );
    assert.equal(
      await isReserveExampleSlotValue(`${RESERVE_EXAMPLE_DATE} 10:30 to 11:00`),
      true,
    );
  });
});
