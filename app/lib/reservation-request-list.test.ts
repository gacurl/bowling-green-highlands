import test from "node:test";
import assert from "node:assert/strict";
import { toReservationRequestListItems } from "./reservation-request-list";
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
  {
    createdAt: "2026-06-15T10:00:00.000Z",
    eventType: "retreat",
    guestEmail: "second@example.com",
    guestName: "Second Guest",
    id: "second-id",
    requestNotes: "",
    requestedDates: "2026-06-15 10:00 to 10:30",
    status: "pending",
  },
];

test("sorts request list items by newest first", () => {
  const requestListItems = toReservationRequestListItems(requests);

  assert.deepEqual(
    requestListItems.map((requestListItem) => requestListItem.id),
    ["second-id", "first-id"],
  );
});

test("formats event and requested slot labels for display", () => {
  const requestListItems = toReservationRequestListItems(requests);

  assert.equal(requestListItems[0].eventTypeLabel, "Retreat");
  assert.equal(
    requestListItems[0].requestedSlotLabel,
    "Monday, June 15, 2026, 10:00 to 10:30",
  );
  assert.equal(requestListItems[0].status, "pending");
});
