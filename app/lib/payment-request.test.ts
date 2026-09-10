import test from "node:test";
import assert from "node:assert/strict";
import { getPaymentRequestState } from "./payment-request";
import type { ReservationRequestRecord } from "./reservation-requests";

const acceptedRequest: ReservationRequestRecord = {
  createdAt: "2026-06-14T09:00:00.000Z",
  eventType: "farm_stay",
  guestEmail: "accepted@example.com",
  guestName: "Accepted Guest",
  id: "accepted-id",
  requestNotes: "private notes",
  requestedDates: "2026-06-14 09:00 to 09:30",
  status: "accepted",
};

const pendingRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  id: "pending-id",
  status: "pending",
};

const declinedRequest: ReservationRequestRecord = {
  ...acceptedRequest,
  id: "declined-id",
  status: "declined",
};

test("allows payment for accepted requests when Stripe config exists", async () => {
  const state = await getPaymentRequestState("accepted-id", true, async () => [
    acceptedRequest,
  ]);

  assert.equal(state.kind, "available");
  assert.equal(state.kind === "available" ? state.request.id : null, "accepted-id");
});

test("does not allow payment when Stripe config is missing", async () => {
  const state = await getPaymentRequestState("accepted-id", false, async () => [
    acceptedRequest,
  ]);

  assert.deepEqual(state, {
    kind: "unavailable",
    reason: "missing_config",
  });
});

test("does not allow payment for pending, declined, or unknown requests", async () => {
  const requests = [pendingRequest, declinedRequest];

  assert.deepEqual(
    await getPaymentRequestState("pending-id", true, async () => requests),
    {
      kind: "unavailable",
      reason: "not_accepted",
    },
  );
  assert.deepEqual(
    await getPaymentRequestState("declined-id", true, async () => requests),
    {
      kind: "unavailable",
      reason: "not_accepted",
    },
  );
  assert.deepEqual(
    await getPaymentRequestState("missing-id", true, async () => requests),
    {
      kind: "unavailable",
      reason: "not_found",
    },
  );
});

test("does not allow payment when reservation requests are unreadable", async () => {
  const state = await getPaymentRequestState("accepted-id", true, async () => {
    throw new Error("store unavailable");
  });

  assert.deepEqual(state, {
    kind: "unavailable",
    reason: "unreadable",
  });
});
