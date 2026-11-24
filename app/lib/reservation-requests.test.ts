import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../../lib/test-support/postgres-test-database";
import {
  createReservationRequestRecord,
  isReservationRequestStatusUpdate,
  markReservationCheckoutSessionRetryable,
  markReservationRequestPaid,
  readReservationRequests,
  updateReservationRequestStatus,
  withLockedReservationCheckoutRequest,
  writeReservationRequests,
} from "./reservation-requests";
import type { ReservationRequestRecord } from "./reservation-requests";

async function createStorePath() {
  return createTestDatabase();
}

async function attachCheckoutSession(
  requestId: string,
  sessionId: string,
  database: Awaited<ReturnType<typeof createStorePath>>,
) {
  const result = await withLockedReservationCheckoutRequest(
    requestId,
    async () => ({
      result: "attached" as const,
      sessionUpdate: {
        id: sessionId,
        retryable: false,
      },
    }),
    database,
  );

  assert.deepEqual(result, {
    kind: "found",
    result: "attached",
  });
}

test("returns empty array when no request rows exist", async () => {
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
  assert.equal(reservationRequests[0].sessionDate, "2026-06-14");
  assert.equal(reservationRequests[0].sessionDurationMinutes, 30);
  assert.equal(reservationRequests[0].sessionStartMinute, 540);
  assert.equal(reservationRequests[1].status, "pending");
  assert.equal(reservationRequests[1].paymentStatus, "unpaid");
  assert.equal(reservationRequests[1].id, secondRequest.id);
  assert.equal(reservationRequests[1].sessionDate, "2026-06-15");
  assert.equal(reservationRequests[1].sessionDurationMinutes, 30);
  assert.equal(reservationRequests[1].sessionStartMinute, 600);
  assert.ok(!Number.isNaN(Date.parse(reservationRequests[0].createdAt)));
  assert.ok(!Number.isNaN(Date.parse(reservationRequests[1].createdAt)));
});

test("stores and reads preferred-time values without rewriting them", async () => {
  const database = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "preferred@example.com",
      guestName: "Preferred Time Guest",
      requestNotes: "",
      requestedDates: "2026-11-19 16:45",
    },
    database,
  );

  assert.equal(
    (await readReservationRequests(database))[0].requestedDates,
    request.requestedDates,
  );
  assert.deepEqual(
    (
      await database.query<{
        requested_dates: string;
        requested_start_key: string;
        session_date: string;
        session_duration_minutes: number | null;
        session_start_minute: number;
      }>(
        `
          SELECT
            requested_dates,
            requested_start_key,
            session_date::text AS session_date,
            session_duration_minutes,
            session_start_minute
          FROM reservation_requests
          WHERE id = $1
        `,
        [request.id],
      )
    ).rows[0],
    {
      requested_dates: "2026-11-19 16:45",
      requested_start_key: "2026-11-19 16:45",
      session_date: "2026-11-19",
      session_duration_minutes: null,
      session_start_minute: 1005,
    },
  );
  assert.equal(request.sessionDate, "2026-11-19");
  assert.equal(request.sessionDurationMinutes, undefined);
  assert.equal(request.sessionStartMinute, 1005);
});

test("stores an explicit duration for a reliable start-only request", async () => {
  const database = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "duration@example.com",
      guestName: "Duration Guest",
      requestNotes: "",
      requestedDates: "2026-11-20 23:30",
      sessionDurationMinutes: 30,
    },
    database,
  );

  assert.equal(request.sessionDate, "2026-11-20");
  assert.equal(request.sessionDurationMinutes, 30);
  assert.equal(request.sessionStartMinute, 1410);
  const [persistedRequest] = await readReservationRequests(database);

  assert.equal(persistedRequest.id, request.id);
  assert.equal(persistedRequest.sessionDate, request.sessionDate);
  assert.equal(
    persistedRequest.sessionDurationMinutes,
    request.sessionDurationMinutes,
  );
  assert.equal(persistedRequest.sessionStartMinute, request.sessionStartMinute);
});

test("rejects invalid or conflicting explicit session durations", async () => {
  const database = await createStorePath();
  const baseInput = {
    eventType: "farm_stay" as const,
    guestEmail: "invalid-duration@example.com",
    guestName: "Invalid Duration Guest",
    requestNotes: "",
  };

  for (const [requestedDates, sessionDurationMinutes] of [
    ["2026-11-20 09:00", 0],
    ["2026-11-20 09:00", 30.5],
    ["2026-11-20 23:30", 31],
    ["2026-11-20 09:00 to 09:30", 20],
    ["legacy free-form value", 30],
  ] as const) {
    await assert.rejects(
      createReservationRequestRecord(
        {
          ...baseInput,
          requestedDates,
          sessionDurationMinutes,
        },
        database,
      ),
    );
  }

  assert.deepEqual(await readReservationRequests(database), []);
});

test("leaves ambiguous raw values unresolved", async () => {
  const database = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "other",
      guestEmail: "ambiguous@example.com",
      guestName: "Ambiguous Guest",
      requestNotes: "",
      requestedDates: "2026-11-20 23:30 to 00:30",
    },
    database,
  );
  const [persistedRequest] = await readReservationRequests(database);

  assert.equal(persistedRequest.requestedDates, request.requestedDates);
  assert.equal(persistedRequest.sessionDate, undefined);
  assert.equal(persistedRequest.sessionDurationMinutes, undefined);
  assert.equal(persistedRequest.sessionStartMinute, undefined);
});

test("does not derive duration from mutable operator availability", async () => {
  const database = await createStorePath();

  await database.query(`
    INSERT INTO operator_availability (
      availability_date,
      duration_minutes,
      mode,
      start_minute
    )
    VALUES ('2026-11-21', 120, 'available', 540)
  `);
  const request = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "availability-independent@example.com",
      guestName: "Availability Independent Guest",
      requestNotes: "",
      requestedDates: "2026-11-21 09:00",
    },
    database,
  );

  await database.query(`
    UPDATE operator_availability
    SET duration_minutes = 20
    WHERE availability_date = '2026-11-21'
  `);
  const [persistedRequest] = await readReservationRequests(database);

  assert.equal(persistedRequest.id, request.id);
  assert.equal(persistedRequest.sessionDate, "2026-11-21");
  assert.equal(persistedRequest.sessionDurationMinutes, undefined);
  assert.equal(persistedRequest.sessionStartMinute, 540);
});

test("accepted explicit session intervals survive operator availability changes", async () => {
  const database = await createStorePath();

  await database.query(`
    INSERT INTO operator_availability (
      availability_date,
      duration_minutes,
      mode,
      start_minute
    )
    VALUES ('2026-11-22', 120, 'available', 540)
  `);
  const request = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "accepted-interval@example.com",
      guestName: "Accepted Interval Guest",
      requestNotes: "",
      requestedDates: "2026-11-22 09:00",
      sessionDurationMinutes: 30,
    },
    database,
  );

  assert.equal(
    await updateReservationRequestStatus(request.id, "accepted", database),
    "updated",
  );
  await database.query(`
    UPDATE operator_availability
    SET duration_minutes = 20,
        start_minute = 600
    WHERE availability_date = '2026-11-22'
  `);
  const [persistedRequest] = await readReservationRequests(database);

  assert.equal(persistedRequest.status, "accepted");
  assert.equal(persistedRequest.sessionDate, "2026-11-22");
  assert.equal(persistedRequest.sessionStartMinute, 540);
  assert.equal(persistedRequest.sessionDurationMinutes, 30);
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
  const seededRequests: ReservationRequestRecord[] = [
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
  ];

  await writeReservationRequests(seededRequests, storePath);

  const reservationRequests = await readReservationRequests(storePath);

  assert.equal(reservationRequests[0].status, "accepted");
  assert.equal(reservationRequests[1].status, "declined");
});

test("normalizes a legacy reservation without payment status to unpaid", async () => {
  const storePath = await createStorePath();
  const legacyRequest: ReservationRequestRecord = {
    createdAt: "2026-06-14T09:00:00.000Z",
    eventType: "farm_stay",
    guestEmail: "legacy@example.com",
    guestName: "Legacy Guest",
    id: "legacy-id",
    requestNotes: "",
    requestedDates: "2026-06-14 09:00 to 09:30",
    status: "accepted",
  };

  await writeReservationRequests([legacyRequest], storePath);

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
    await attachCheckoutSession(targetRequest.id, "cs_test_target", storePath),
    undefined,
  );
  assert.equal(
    await markReservationRequestPaid(
      targetRequest.id,
      "cs_test_target",
      storePath,
    ),
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
    await markReservationRequestPaid(
      pendingRequest.id,
      "cs_test_pending",
      storePath,
    ),
    "not_accepted",
  );
  assert.equal(
    await markReservationRequestPaid(
      declinedRequest.id,
      "cs_test_declined",
      storePath,
    ),
    "not_accepted",
  );
  assert.equal(
    await markReservationRequestPaid(
      "missing-id",
      "cs_test_missing",
      storePath,
    ),
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
    await attachCheckoutSession(request.id, "cs_test_paid", storePath),
    undefined,
  );
  assert.equal(
    await markReservationRequestPaid(request.id, "cs_test_paid", storePath),
    "updated",
  );

  assert.equal(
    await markReservationRequestPaid(request.id, "cs_test_paid", storePath),
    "already_paid",
  );
  assert.equal(
    (await readReservationRequests(storePath))[0].paymentStatus,
    "paid",
  );
});

test("paid and retryable mutations reject stale Checkout Sessions", async () => {
  const database = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "stale-session@example.com",
      guestName: "Stale Session Guest",
      requestNotes: "",
      requestedDates: "2026-08-06 09:00 to 09:30",
    },
    database,
  );
  assert.equal(
    await updateReservationRequestStatus(request.id, "accepted", database),
    "updated",
  );
  await attachCheckoutSession(request.id, "cs_test_current", database);

  assert.equal(
    await markReservationRequestPaid(request.id, "cs_test_stale", database),
    "stale_session",
  );
  assert.equal(
    await markReservationCheckoutSessionRetryable(
      request.id,
      "cs_test_stale",
      database,
    ),
    "stale_session",
  );

  const [persistedRequest] = await readReservationRequests(database);

  assert.equal(persistedRequest.paymentStatus, "unpaid");
  assert.equal(persistedRequest.stripeCheckoutSessionId, "cs_test_current");
  assert.equal(persistedRequest.stripeCheckoutSessionRetryable, false);
});

test("duplicate failure delivery marks only the current Session retryable", async () => {
  const database = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "retryable@example.com",
      guestName: "Retryable Guest",
      requestNotes: "",
      requestedDates: "2026-08-07 09:00 to 09:30",
    },
    database,
  );
  assert.equal(
    await updateReservationRequestStatus(request.id, "accepted", database),
    "updated",
  );
  await attachCheckoutSession(request.id, "cs_test_retryable", database);

  assert.equal(
    await markReservationCheckoutSessionRetryable(
      request.id,
      "cs_test_retryable",
      database,
    ),
    "updated",
  );
  assert.equal(
    await markReservationCheckoutSessionRetryable(
      request.id,
      "cs_test_retryable",
      database,
    ),
    "already_retryable",
  );
  assert.equal(
    (await readReservationRequests(database))[0]
      .stripeCheckoutSessionRetryable,
    true,
  );
});

test("concurrent duplicate paid delivery produces one payment transition", async () => {
  const database = await createStorePath();
  const request = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "concurrent-paid@example.com",
      guestName: "Concurrent Paid Guest",
      requestNotes: "",
      requestedDates: "2026-08-08 09:00 to 09:30",
    },
    database,
  );
  assert.equal(
    await updateReservationRequestStatus(request.id, "accepted", database),
    "updated",
  );
  await attachCheckoutSession(request.id, "cs_test_concurrent_paid", database);

  const results = await Promise.all([
    markReservationRequestPaid(
      request.id,
      "cs_test_concurrent_paid",
      database,
    ),
    markReservationRequestPaid(
      request.id,
      "cs_test_concurrent_paid",
      database,
    ),
  ]);

  assert.deepEqual(results.sort(), ["already_paid", "updated"]);
  assert.equal(
    (await readReservationRequests(database))[0].paymentStatus,
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

test("rejects duplicate request ids and rolls back the replacement", async () => {
  const storePath = await createStorePath();
  const seededRequests: ReservationRequestRecord[] = [
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
  ];

  await assert.rejects(writeReservationRequests(seededRequests, storePath));
  assert.deepEqual(await readReservationRequests(storePath), []);
});

test("blocks a preferred-time request matching an accepted legacy start", async () => {
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
      requestedDates: "2026-07-01 09:00",
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

test("database uniqueness blocks accepted legacy and preferred values with one start", async () => {
  const database = await createStorePath();
  const legacyRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "legacy-unique@example.com",
      guestName: "Legacy Unique Guest",
      requestNotes: "",
      requestedDates: "2026-07-06 09:00 to 09:30",
    },
    database,
  );
  const preferredRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "preferred-unique@example.com",
      guestName: "Preferred Unique Guest",
      requestNotes: "",
      requestedDates: "2026-07-06 09:00",
    },
    database,
  );

  assert.equal(
    await updateReservationRequestStatus(legacyRequest.id, "accepted", database),
    "updated",
  );
  await assert.rejects(
    database.query(
      "UPDATE reservation_requests SET status = 'accepted' WHERE id = $1",
      [preferredRequest.id],
    ),
    /reservation_requests_one_accepted_exact_slot/,
  );
  assert.equal(
    (await readReservationRequests(database)).find(
      (request) => request.id === preferredRequest.id,
    )?.status,
    "pending",
  );
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
      requestedDates: "2026-07-04 09:00",
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

test("concurrent acceptance permits only one legacy or preferred request per start", async () => {
  const database = await createStorePath();
  const firstRequest = await createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "first-concurrent@example.com",
      guestName: "First Concurrent Guest",
      requestNotes: "",
      requestedDates: "2026-07-05 09:00 to 09:30",
    },
    database,
  );
  const secondRequest = await createReservationRequestRecord(
    {
      eventType: "retreat",
      guestEmail: "second-concurrent@example.com",
      guestName: "Second Concurrent Guest",
      requestNotes: "",
      requestedDates: "2026-07-05 09:00",
    },
    database,
  );

  const results = await Promise.all([
    updateReservationRequestStatus(firstRequest.id, "accepted", database),
    updateReservationRequestStatus(secondRequest.id, "accepted", database),
  ]);

  assert.deepEqual(results.sort(), ["slot_conflict", "updated"]);
  assert.equal(
    (await readReservationRequests(database)).filter(
      (request) => request.status === "accepted",
    ).length,
    1,
  );
});
