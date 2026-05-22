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
});

test("returns null for an unknown request id", () => {
  const requestDetailItem = toReservationRequestDetailItem(requests, "missing-id");

  assert.equal(requestDetailItem, null);
});
