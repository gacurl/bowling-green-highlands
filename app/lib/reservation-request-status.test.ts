import test from "node:test";
import assert from "node:assert/strict";
import {
  getReservationRequestStatusBadgeClass,
  getReservationRequestStatusLabel,
} from "./reservation-request-status";

test("returns plain request-based status labels", () => {
  assert.equal(getReservationRequestStatusLabel("pending"), "Pending request");
  assert.equal(getReservationRequestStatusLabel("accepted"), "Accepted request");
  assert.equal(getReservationRequestStatusLabel("declined"), "Declined request");
});

test("returns status badge classes for each status", () => {
  assert.match(
    getReservationRequestStatusBadgeClass("pending"),
    /border-amber-200/,
  );
  assert.match(
    getReservationRequestStatusBadgeClass("accepted"),
    /border-emerald-200/,
  );
  assert.match(
    getReservationRequestStatusBadgeClass("declined"),
    /border-zinc-300/,
  );
});
