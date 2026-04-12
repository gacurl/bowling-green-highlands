import test from "node:test";
import assert from "node:assert/strict";
import { isSlotAvailable } from "./reservations";
import type { Slot } from "./slots";

const baseSlot: Slot = {
  date: "2026-06-12",
  startTime: "09:00",
  endTime: "09:30",
  status: "available",
};

test("returns false for an exact duplicate slot reservation", () => {
  assert.equal(isSlotAvailable(baseSlot, [baseSlot]), false);
});

test("returns true when there are no existing reservations", () => {
  assert.equal(isSlotAvailable(baseSlot, []), true);
});

test("returns true for a different date", () => {
  const existingReservation: Slot = {
    ...baseSlot,
    date: "2026-06-13",
  };

  assert.equal(isSlotAvailable(baseSlot, [existingReservation]), true);
});

test("returns true for a different start time", () => {
  const existingReservation: Slot = {
    ...baseSlot,
    startTime: "09:30",
  };

  assert.equal(isSlotAvailable(baseSlot, [existingReservation]), true);
});

test("returns true for a different end time", () => {
  const existingReservation: Slot = {
    ...baseSlot,
    endTime: "10:00",
  };

  assert.equal(isSlotAvailable(baseSlot, [existingReservation]), true);
});
