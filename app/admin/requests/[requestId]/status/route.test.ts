import assert from "node:assert/strict";
import test from "node:test";
import {
  setDatabaseForTests,
  type DatabaseAccess,
} from "../../../../../lib/server/database";
import {
  createTestDatabase,
  createUnavailableTestDatabase,
} from "../../../../../lib/test-support/postgres-test-database";
import {
  createReservationRequestRecord,
  readReservationRequests,
  updateReservationRequestStatus,
} from "../../../../lib/reservation-requests";
import { POST } from "./route";

const REQUEST_ORIGIN = "http://localhost";

function createStatusRequest(requestId: string, status?: string) {
  const body = new URLSearchParams();

  if (status !== undefined) {
    body.set("status", status);
  }

  return new Request(
    `${REQUEST_ORIGIN}/admin/requests/${requestId}/status`,
    {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  );
}

function createRouteProps(requestId: string) {
  return {
    params: Promise.resolve({ requestId }),
  };
}

async function createPendingRequest(
  database: DatabaseAccess,
  requestedDates: string,
) {
  return createReservationRequestRecord(
    {
      eventType: "farm_stay",
      guestEmail: "route-test@example.com",
      guestName: "Route Test Guest",
      requestNotes: "",
      requestedDates,
    },
    database,
  );
}

async function withTestDatabase(
  database: DatabaseAccess,
  runTest: () => Promise<void>,
) {
  setDatabaseForTests(database);

  try {
    await runTest();
  } finally {
    setDatabaseForTests(null);
  }
}

function assertSeeOther(response: Response, destination: string) {
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), `${REQUEST_ORIGIN}${destination}`);
}

test("successful acceptance redirects with 303 and persists accepted status", async () => {
  const database = await createTestDatabase();
  const reservationRequest = await createPendingRequest(
    database,
    "2026-12-01 09:00 to 09:30",
  );

  await withTestDatabase(database, async () => {
    const response = await POST(
      createStatusRequest(reservationRequest.id, "accepted"),
      createRouteProps(reservationRequest.id),
    );

    assertSeeOther(response, `/admin/requests/${reservationRequest.id}`);
    assert.equal((await readReservationRequests(database))[0].status, "accepted");
  });
});

test("successful decline redirects with 303 and persists declined status", async () => {
  const database = await createTestDatabase();
  const reservationRequest = await createPendingRequest(
    database,
    "2026-12-01 10:00 to 10:30",
  );

  await withTestDatabase(database, async () => {
    const response = await POST(
      createStatusRequest(reservationRequest.id, "declined"),
      createRouteProps(reservationRequest.id),
    );

    assertSeeOther(response, `/admin/requests/${reservationRequest.id}`);
    assert.equal((await readReservationRequests(database))[0].status, "declined");
  });
});

test("missing status redirects with 303 to invalid status", async () => {
  const requestId = "missing-status-id";
  const response = await POST(
    createStatusRequest(requestId),
    createRouteProps(requestId),
  );

  assertSeeOther(
    response,
    `/admin/requests/${requestId}?error=invalid_status`,
  );
});

test("invalid status redirects with 303 to invalid status", async () => {
  const requestId = "invalid-status-id";
  const response = await POST(
    createStatusRequest(requestId, "pending"),
    createRouteProps(requestId),
  );

  assertSeeOther(
    response,
    `/admin/requests/${requestId}?error=invalid_status`,
  );
});

test("unknown request redirects with 303 to the Admin not-found error", async () => {
  const database = await createTestDatabase();
  const requestId = "unknown-request-id";

  await withTestDatabase(database, async () => {
    const response = await POST(
      createStatusRequest(requestId, "accepted"),
      createRouteProps(requestId),
    );

    assertSeeOther(response, "/admin?error=request_not_found");
  });
});

test("invalid transition redirects with 303 to the request error", async () => {
  const database = await createTestDatabase();
  const reservationRequest = await createPendingRequest(
    database,
    "2026-12-01 11:00 to 11:30",
  );
  assert.equal(
    await updateReservationRequestStatus(
      reservationRequest.id,
      "accepted",
      database,
    ),
    "updated",
  );

  await withTestDatabase(database, async () => {
    const response = await POST(
      createStatusRequest(reservationRequest.id, "declined"),
      createRouteProps(reservationRequest.id),
    );

    assertSeeOther(
      response,
      `/admin/requests/${reservationRequest.id}?error=invalid_transition`,
    );
    assert.equal((await readReservationRequests(database))[0].status, "accepted");
  });
});

test("slot conflict redirects with 303 and leaves the request pending", async () => {
  const database = await createTestDatabase();
  const requestedDates = "2026-12-01 12:00 to 12:30";
  const acceptedRequest = await createPendingRequest(database, requestedDates);
  const conflictingRequest = await createPendingRequest(database, requestedDates);
  assert.equal(
    await updateReservationRequestStatus(
      acceptedRequest.id,
      "accepted",
      database,
    ),
    "updated",
  );

  await withTestDatabase(database, async () => {
    const response = await POST(
      createStatusRequest(conflictingRequest.id, "accepted"),
      createRouteProps(conflictingRequest.id),
    );

    assertSeeOther(
      response,
      `/admin/requests/${conflictingRequest.id}?error=slot_conflict`,
    );
    const persistedRequest = (await readReservationRequests(database)).find(
      ({ id }) => id === conflictingRequest.id,
    );
    assert.equal(persistedRequest?.status, "pending");
  });
});

test("persistence exception redirects with 303 to action failed", async () => {
  const database = createUnavailableTestDatabase();
  const requestId = "unavailable-database-id";

  await withTestDatabase(database, async () => {
    const response = await POST(
      createStatusRequest(requestId, "accepted"),
      createRouteProps(requestId),
    );

    assertSeeOther(
      response,
      `/admin/requests/${requestId}?error=action_failed`,
    );
  });
});
