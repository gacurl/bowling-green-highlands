import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createReservationRequestRecord,
  isReservationRequestStatusUpdate,
  readReservationRequests,
  updateReservationRequestStatus,
} from "./reservation-requests";

async function createStorePath() {
  const directory = await mkdtemp(path.join(tmpdir(), "bgh-requests-"));

  return path.join(directory, "reservation-requests.json");
}

test("returns empty array when no request store exists", async () => {
  assert.deepEqual(await readReservationRequests(await createStorePath()), []);
});

test("stores and reads pending reservation requests", async () => {
  const storePath = await createStorePath();

  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "guest1@example.com",
      guestName: "Guest One",
      requestNotes: "First note",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );

  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "guest2@example.com",
      guestName: "Guest Two",
      requestNotes: "Second note",
      requestedDates: "2026-06-15 10:00 to 10:30",
    },
    storePath,
  );

  const reservationRequests = await readReservationRequests(storePath);

  assert.equal(reservationRequests.length, 2);
  assert.equal(reservationRequests[0].status, "pending");
  assert.equal(reservationRequests[0].id, firstRequest.id);
  assert.equal(reservationRequests[1].status, "pending");
  assert.equal(reservationRequests[1].id, secondRequest.id);
  assert.ok(!Number.isNaN(Date.parse(reservationRequests[0].createdAt)));
  assert.ok(!Number.isNaN(Date.parse(reservationRequests[1].createdAt)));
});

test("updates a pending request to accepted", async () => {
  const storePath = await createStorePath();
  const requestRecord = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "guest@example.com",
      guestName: "Guest",
      requestNotes: "",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );

  const updateResult = await updateReservationRequestStatus(
    requestRecord.id,
    "accepted",
    storePath,
  );

  assert.equal(updateResult, "updated");
  assert.equal((await readReservationRequests(storePath))[0].status, "accepted");
});

test("updates a pending request to declined", async () => {
  const storePath = await createStorePath();
  const requestRecord = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "guest@example.com",
      guestName: "Guest",
      requestNotes: "",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );

  const updateResult = await updateReservationRequestStatus(
    requestRecord.id,
    "declined",
    storePath,
  );

  assert.equal(updateResult, "updated");
  assert.equal((await readReservationRequests(storePath))[0].status, "declined");
});

test("returns not_found for unknown request id updates", async () => {
  const storePath = await createStorePath();

  assert.equal(
    await updateReservationRequestStatus("missing-id", "accepted", storePath),
    "not_found",
  );
});

test("returns invalid_transition when updating a non-pending request", async () => {
  const storePath = await createStorePath();
  const requestRecord = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "guest@example.com",
      guestName: "Guest",
      requestNotes: "",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(requestRecord.id, "accepted", storePath),
    "updated",
  );
  assert.equal(
    await updateReservationRequestStatus(requestRecord.id, "declined", storePath),
    "invalid_transition",
  );
});

test("rejects invalid status update values", () => {
  assert.equal(isReservationRequestStatusUpdate("accepted"), true);
  assert.equal(isReservationRequestStatusUpdate("declined"), true);
  assert.equal(isReservationRequestStatusUpdate("pending"), false);
  assert.equal(isReservationRequestStatusUpdate("booked"), false);
});

test("reads accepted and declined statuses from persisted requests", async () => {
  const storePath = await createStorePath();
  const seededStore = {
    requests: [
      {
        createdAt: "2026-06-14T09:00:00.000Z",
        eventType: "farm_stay",
        guestEmail: "accepted@example.com",
        guestName: "Accepted Guest",
        id: "accepted-id",
        requestNotes: "",
        requestedDates: "2026-06-14 09:00 to 09:30",
        status: "accepted",
      },
      {
        createdAt: "2026-06-15T09:00:00.000Z",
        eventType: "retreat",
        guestEmail: "declined@example.com",
        guestName: "Declined Guest",
        id: "declined-id",
        requestNotes: "",
        requestedDates: "2026-06-15 09:00 to 09:30",
        status: "declined",
      },
    ],
  };

  await writeFile(storePath, `${JSON.stringify(seededStore, null, 2)}\n`, "utf8");

  const reservationRequests = await readReservationRequests(storePath);

  assert.equal(reservationRequests[0].status, "accepted");
  assert.equal(reservationRequests[1].status, "declined");
});

test("accepting one request does not change another request", async () => {
  const storePath = await createStorePath();
  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "first@example.com",
      guestName: "First Guest",
      requestNotes: "",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );
  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "second@example.com",
      guestName: "Second Guest",
      requestNotes: "",
      requestedDates: "2026-06-15 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(firstRequest.id, "accepted", storePath),
    "updated",
  );

  const reservationRequests = await readReservationRequests(storePath);
  const updatedFirst = reservationRequests.find(
    (requestRecord) => requestRecord.id === firstRequest.id,
  );
  const untouchedSecond = reservationRequests.find(
    (requestRecord) => requestRecord.id === secondRequest.id,
  );

  assert.ok(updatedFirst);
  assert.ok(untouchedSecond);
  assert.equal(updatedFirst.status, "accepted");
  assert.equal(untouchedSecond.status, "pending");
});

test("declining one request does not change another request", async () => {
  const storePath = await createStorePath();
  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "first@example.com",
      guestName: "First Guest",
      requestNotes: "",
      requestedDates: "2026-06-14 09:00 to 09:30",
    },
    storePath,
  );
  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "second@example.com",
      guestName: "Second Guest",
      requestNotes: "",
      requestedDates: "2026-06-15 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(firstRequest.id, "declined", storePath),
    "updated",
  );

  const reservationRequests = await readReservationRequests(storePath);
  const updatedFirst = reservationRequests.find(
    (requestRecord) => requestRecord.id === firstRequest.id,
  );
  const untouchedSecond = reservationRequests.find(
    (requestRecord) => requestRecord.id === secondRequest.id,
  );

  assert.ok(updatedFirst);
  assert.ok(untouchedSecond);
  assert.equal(updatedFirst.status, "declined");
  assert.equal(untouchedSecond.status, "pending");
});

test("updates only one record when duplicate request ids exist", async () => {
  const storePath = await createStorePath();
  const seededStore = {
    requests: [
      {
        createdAt: "2026-06-14T09:00:00.000Z",
        eventType: "farm_stay",
        guestEmail: "one@example.com",
        guestName: "One",
        id: "duplicate-id",
        requestNotes: "",
        requestedDates: "2026-06-14 09:00 to 09:30",
        status: "pending",
      },
      {
        createdAt: "2026-06-15T09:00:00.000Z",
        eventType: "retreat",
        guestEmail: "two@example.com",
        guestName: "Two",
        id: "duplicate-id",
        requestNotes: "",
        requestedDates: "2026-06-15 09:00 to 09:30",
        status: "pending",
      },
    ],
  };

  await writeFile(storePath, `${JSON.stringify(seededStore, null, 2)}\n`, "utf8");

  assert.equal(
    await updateReservationRequestStatus("duplicate-id", "accepted", storePath),
    "updated",
  );

  const reservationRequests = await readReservationRequests(storePath);
  const acceptedCount = reservationRequests.filter(
    (requestRecord) => requestRecord.status === "accepted",
  ).length;

  assert.equal(acceptedCount, 1);
  assert.equal(reservationRequests[1].status, "pending");
});

test("blocks accepting a second pending request for the same requested slot", async () => {
  const storePath = await createStorePath();
  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "first@example.com",
      guestName: "First Guest",
      requestNotes: "",
      requestedDates: "2026-07-01 09:00 to 09:30",
    },
    storePath,
  );
  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "second@example.com",
      guestName: "Second Guest",
      requestNotes: "",
      requestedDates: "2026-07-01 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(firstRequest.id, "accepted", storePath),
    "updated",
  );
  assert.equal(
    await updateReservationRequestStatus(secondRequest.id, "accepted", storePath),
    "slot_conflict",
  );

  const reservationRequests = await readReservationRequests(storePath);
  const acceptedRequest = reservationRequests.find(
    (requestRecord) => requestRecord.id === firstRequest.id,
  );
  const blockedRequest = reservationRequests.find(
    (requestRecord) => requestRecord.id === secondRequest.id,
  );

  assert.ok(acceptedRequest);
  assert.ok(blockedRequest);
  assert.equal(acceptedRequest.status, "accepted");
  assert.equal(blockedRequest.status, "pending");
});

test("accepting a pending request with a different slot still succeeds", async () => {
  const storePath = await createStorePath();
  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "first@example.com",
      guestName: "First Guest",
      requestNotes: "",
      requestedDates: "2026-07-02 09:00 to 09:30",
    },
    storePath,
  );
  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "second@example.com",
      guestName: "Second Guest",
      requestNotes: "",
      requestedDates: "2026-07-03 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(firstRequest.id, "accepted", storePath),
    "updated",
  );
  assert.equal(
    await updateReservationRequestStatus(secondRequest.id, "accepted", storePath),
    "updated",
  );
});

test("declining still works when another request for the same slot is accepted", async () => {
  const storePath = await createStorePath();
  const acceptedRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "accepted@example.com",
      guestName: "Accepted Guest",
      requestNotes: "",
      requestedDates: "2026-07-04 09:00 to 09:30",
    },
    storePath,
  );
  const declinedRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "declined@example.com",
      guestName: "Declined Guest",
      requestNotes: "",
      requestedDates: "2026-07-04 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(acceptedRequest.id, "accepted", storePath),
    "updated",
  );
  assert.equal(
    await updateReservationRequestStatus(declinedRequest.id, "declined", storePath),
    "updated",
  );

  const reservationRequests = await readReservationRequests(storePath);
  const updatedDeclinedRequest = reservationRequests.find(
    (requestRecord) => requestRecord.id === declinedRequest.id,
  );

  assert.ok(updatedDeclinedRequest);
  assert.equal(updatedDeclinedRequest.status, "declined");
});
