import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createReservationRequestRecord,
  isReservationRequestStatusUpdate,
  markReservationRequestPaid,
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
  assert.equal(reservationRequests[0].paymentStatus, "unpaid");
  assert.equal(reservationRequests[0].id, firstRequest.id);
  assert.equal(reservationRequests[1].status, "pending");
  assert.equal(reservationRequests[1].paymentStatus, "unpaid");
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
  const updatedRequest = (await readReservationRequests(storePath))[0];

  assert.equal(updatedRequest.status, "accepted");
  assert.ok(updatedRequest.statusUpdatedAt);
  assert.ok(!Number.isNaN(Date.parse(updatedRequest.statusUpdatedAt)));
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
  const updatedRequest = (await readReservationRequests(storePath))[0];

  assert.equal(updatedRequest.status, "declined");
  assert.ok(updatedRequest.statusUpdatedAt);
  assert.ok(!Number.isNaN(Date.parse(updatedRequest.statusUpdatedAt)));
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

test("normalizes a legacy reservation without payment status to unpaid", async () => {
  const storePath = await createStorePath();
  const legacyRequest = {
    createdAt: "2026-06-14T09:00:00.000Z",
    eventType: "farm_stay",
    guestEmail: "legacy@example.com",
    guestName: "Legacy Guest",
    id: "legacy-id",
    requestNotes: "",
    requestedDates: "2026-06-14 09:00 to 09:30",
    status: "accepted",
  };

  await writeFile(
    storePath,
    `${JSON.stringify({ requests: [legacyRequest] }, null, 2)}\n`,
    "utf8",
  );

  const [normalizedRequest] = await readReservationRequests(storePath);

  assert.equal(normalizedRequest.paymentStatus, "unpaid");
});

test("marks only the targeted accepted reservation as paid", async () => {
  const storePath = await createStorePath();
  const targetRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "target@example.com",
      guestName: "Target Guest",
      requestNotes: "",
      requestedDates: "2026-08-01 09:00 to 09:30",
    },
    storePath,
  );
  const otherRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "other@example.com",
      guestName: "Other Guest",
      requestNotes: "",
      requestedDates: "2026-08-02 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(targetRequest.id, "accepted", storePath),
    "updated",
  );
  assert.equal(
    await updateReservationRequestStatus(otherRequest.id, "accepted", storePath),
    "updated",
  );
  const otherRequestBeforePayment = (await readReservationRequests(storePath)).find(
    (requestRecord) => requestRecord.id === otherRequest.id,
  );

  assert.equal(
    await markReservationRequestPaid(targetRequest.id, storePath),
    "updated",
  );

  const reservationRequests = await readReservationRequests(storePath);
  const paidTarget = reservationRequests.find(
    (requestRecord) => requestRecord.id === targetRequest.id,
  );
  const untouchedOther = reservationRequests.find(
    (requestRecord) => requestRecord.id === otherRequest.id,
  );

  assert.equal(paidTarget?.paymentStatus, "paid");
  assert.deepEqual(untouchedOther, otherRequestBeforePayment);
});

test("does not mark pending, declined, or missing reservations as paid", async () => {
  const storePath = await createStorePath();
  const pendingRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "pending@example.com",
      guestName: "Pending Guest",
      requestNotes: "",
      requestedDates: "2026-08-03 09:00 to 09:30",
    },
    storePath,
  );
  const declinedRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "declined@example.com",
      guestName: "Declined Guest",
      requestNotes: "",
      requestedDates: "2026-08-04 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(declinedRequest.id, "declined", storePath),
    "updated",
  );
  assert.equal(
    await markReservationRequestPaid(pendingRequest.id, storePath),
    "not_accepted",
  );
  assert.equal(
    await markReservationRequestPaid(declinedRequest.id, storePath),
    "not_accepted",
  );
  assert.equal(
    await markReservationRequestPaid("missing-id", storePath),
    "not_found",
  );

  const reservationRequests = await readReservationRequests(storePath);

  assert.ok(
    reservationRequests.every(
      (requestRecord) => requestRecord.paymentStatus === "unpaid",
    ),
  );
});

test("an already-paid reservation remains paid without another write", async () => {
  const storePath = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "paid@example.com",
      guestName: "Paid Guest",
      requestNotes: "",
      requestedDates: "2026-08-05 09:00 to 09:30",
    },
    storePath,
  );

  assert.equal(
    await updateReservationRequestStatus(request.id, "accepted", storePath),
    "updated",
  );
  assert.equal(
    await markReservationRequestPaid(request.id, storePath),
    "updated",
  );

  await mkdir(`${storePath}.tmp`);

  assert.equal(
    await markReservationRequestPaid(request.id, storePath),
    "already_paid",
  );
  assert.equal(
    (await readReservationRequests(storePath))[0].paymentStatus,
    "paid",
  );
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
