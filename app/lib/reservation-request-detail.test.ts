import test from "node:test";
import assert from "node:assert/strict";
import { toReservationRequestDetailItem } from "./reservation-request-detail";
import type { ReservationRequestRecord } from "./reservation-requests";

const requests: ReservationRequestRecord[] = [
  {
    createdAt: "2026-06-14T09:00:00.000Z",
    eventType: "farm_stay",
    guestEmail: "first@example.com",
    guestName: "First Guest",
    id: "first-id",
    requestNotes: "First note",
    requestedDates: "2026-06-14 09:00 to 09:30",
    status: "pending",
  },
];

test("returns a friendly request detail item for a known request id", () => {
  const requestDetailItem = toReservationRequestDetailItem(requests, "first-id");

  assert.ok(requestDetailItem);
  assert.equal(requestDetailItem.eventTypeLabel, "Farm stay");
  assert.equal(
    requestDetailItem.requestedSlotLabel,
    "Sunday, June 14, 2026, 09:00 to 09:30",
  );
  assert.equal(requestDetailItem.status, "pending");
  assert.equal(requestDetailItem.statusUpdatedAtLabel, null);
  assert.equal(requestDetailItem.publicPaymentPath, null);
});

test("returns null for an unknown request id", () => {
  const requestDetailItem = toReservationRequestDetailItem(requests, "missing-id");

  assert.equal(requestDetailItem, null);
});

test("returns a status-updated label when a timestamp is present", () => {
  const requestWithStatusUpdate: ReservationRequestRecord = {
    ...requests[0],
    id: "updated-id",
    status: "accepted",
    statusUpdatedAt: "2026-06-15T12:30:00.000Z",
  };
  const requestDetailItem = toReservationRequestDetailItem(
    [requestWithStatusUpdate],
    "updated-id",
  );

  assert.ok(requestDetailItem);
  assert.equal(requestDetailItem.status, "accepted");
  assert.equal(requestDetailItem.publicPaymentPath, "/pay/updated-id");
  assert.ok(requestDetailItem.statusUpdatedAtLabel);
});

test("only accepted request details expose a public payment path", () => {
  const acceptedRequest: ReservationRequestRecord = {
    ...requests[0],
    id: "accepted-id",
    status: "accepted",
  };
  const declinedRequest: ReservationRequestRecord = {
    ...requests[0],
    id: "declined-id",
    status: "declined",
  };

  assert.equal(
    toReservationRequestDetailItem([acceptedRequest], "accepted-id")
      ?.publicPaymentPath,
    "/pay/accepted-id",
  );
  assert.equal(
    toReservationRequestDetailItem([requests[0]], "first-id")?.publicPaymentPath,
    null,
  );
  assert.equal(
    toReservationRequestDetailItem([declinedRequest], "declined-id")
      ?.publicPaymentPath,
    null,
  );
});
