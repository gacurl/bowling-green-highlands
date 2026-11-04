import test from "node:test";
import assert from "node:assert/strict";
import {
  setDatabaseForTests,
  type DatabaseAccess,
} from "./server/database";
import { createTestDatabase } from "./test-support/postgres-test-database";
import {
  getReserveDateOptions,
  validatePreferredTimeRequest,
} from "./reserve-example-availability";
import {
  setOperatorDateAvailability,
  setOperatorDateAvailabilityWindow,
} from "./operator-availability";
import {
  createReservationRequestRecord,
  updateReservationRequestStatus,
} from "../app/lib/reservation-requests";

const TEST_DATE = "2026-06-14";

async function withAvailabilityStore<T>(
  runTest: (database: DatabaseAccess) => Promise<T>,
) {
  const database = await createTestDatabase();
  setDatabaseForTests(database);

  try {
    return await runTest(database);
  } finally {
    setDatabaseForTests(null);
  }
}

test("returns only configured available dates with their actual windows", async () => {
  await withAvailabilityStore(async (database) => {
    await setOperatorDateAvailabilityWindow(
      "2026-11-29",
      14 * 60,
      2 * 60,
      database,
    );
    await setOperatorDateAvailability("2026-11-30", "unavailable", database);
    await setOperatorDateAvailabilityWindow(
      "2026-11-28",
      9 * 60,
      4 * 60,
      database,
    );

    assert.deepEqual(await getReserveDateOptions(), [
      {
        date: "2026-11-28",
        endMinute: 13 * 60,
        startMinute: 9 * 60,
      },
      {
        date: "2026-11-29",
        endMinute: 16 * 60,
        startMinute: 14 * 60,
      },
    ]);
  });
});

test("returns no public dates when availability is unconfigured or blocked", async () => {
  await withAvailabilityStore(async (database) => {
    assert.deepEqual(await getReserveDateOptions(), []);

    await setOperatorDateAvailability(TEST_DATE, "unavailable", database);

    assert.deepEqual(await getReserveDateOptions(), []);
  });
});

test("accepts canonical quarter-hour starts inside the current window", async () => {
  await withAvailabilityStore(async (database) => {
    await setOperatorDateAvailabilityWindow(
      TEST_DATE,
      9 * 60,
      4 * 60,
      database,
    );

    for (const preferredTime of ["09:00", "09:15", "12:45"]) {
      assert.equal(
        await validatePreferredTimeRequest(TEST_DATE, preferredTime),
        `${TEST_DATE} ${preferredTime}`,
      );
    }
  });
});

test("rejects malformed, non-quarter-hour, and out-of-window values", async () => {
  await withAvailabilityStore(async (database) => {
    await setOperatorDateAvailabilityWindow(
      TEST_DATE,
      9 * 60,
      4 * 60,
      database,
    );

    for (const [date, preferredTime] of [
      ["2026-02-30", "09:00"],
      [TEST_DATE, "9:00"],
      [TEST_DATE, "09:10"],
      [TEST_DATE, "08:45"],
      [TEST_DATE, "13:00"],
      [TEST_DATE, "24:00"],
    ]) {
      assert.equal(await validatePreferredTimeRequest(date, preferredTime), null);
    }
  });
});

test("rejects unconfigured, blocked, and stale dates", async () => {
  await withAvailabilityStore(async (database) => {
    assert.equal(
      await validatePreferredTimeRequest(TEST_DATE, "09:00"),
      null,
    );

    await setOperatorDateAvailabilityWindow(
      TEST_DATE,
      9 * 60,
      2 * 60,
      database,
    );
    assert.equal(
      await validatePreferredTimeRequest(TEST_DATE, "09:00"),
      `${TEST_DATE} 09:00`,
    );

    await setOperatorDateAvailability(TEST_DATE, "unavailable", database);
    assert.equal(
      await validatePreferredTimeRequest(TEST_DATE, "09:00"),
      null,
    );
  });
});

test("accepted legacy and preferred starts conflict while pending and declined do not", async () => {
  await withAvailabilityStore(async (database) => {
    await setOperatorDateAvailabilityWindow(
      TEST_DATE,
      9 * 60,
      2 * 60,
      database,
    );
    const legacyAccepted = await createReservationRequestRecord(
      {
        eventType: "farm_stay",
        guestEmail: "legacy@example.com",
        guestName: "Legacy Accepted",
        requestNotes: "",
        requestedDates: `${TEST_DATE} 09:00 to 09:30`,
      },
      database,
    );
    const preferredAccepted = await createReservationRequestRecord(
      {
        eventType: "retreat",
        guestEmail: "preferred@example.com",
        guestName: "Preferred Accepted",
        requestNotes: "",
        requestedDates: `${TEST_DATE} 09:15`,
      },
      database,
    );
    await createReservationRequestRecord(
      {
        eventType: "wedding",
        guestEmail: "pending@example.com",
        guestName: "Pending Guest",
        requestNotes: "",
        requestedDates: `${TEST_DATE} 09:30`,
      },
      database,
    );
    const declined = await createReservationRequestRecord(
      {
        eventType: "other",
        guestEmail: "declined@example.com",
        guestName: "Declined Guest",
        requestNotes: "",
        requestedDates: `${TEST_DATE} 09:45`,
      },
      database,
    );

    assert.equal(
      await updateReservationRequestStatus(
        legacyAccepted.id,
        "accepted",
        database,
      ),
      "updated",
    );
    assert.equal(
      await updateReservationRequestStatus(
        preferredAccepted.id,
        "accepted",
        database,
      ),
      "updated",
    );
    assert.equal(
      await updateReservationRequestStatus(declined.id, "declined", database),
      "updated",
    );

    assert.equal(await validatePreferredTimeRequest(TEST_DATE, "09:00"), null);
    assert.equal(await validatePreferredTimeRequest(TEST_DATE, "09:15"), null);
    assert.equal(
      await validatePreferredTimeRequest(TEST_DATE, "09:30"),
      `${TEST_DATE} 09:30`,
    );
    assert.equal(
      await validatePreferredTimeRequest(TEST_DATE, "09:45"),
      `${TEST_DATE} 09:45`,
    );
  });
});
