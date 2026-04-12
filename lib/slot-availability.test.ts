import test from "node:test";
import assert from "node:assert/strict";
import { applyReservationAvailability } from "./slot-availability.ts";
import type { Slot } from "./slots";

const slots: Slot[] = [
  {
    date: "2026-06-12",
    startTime: "09:00",
    endTime: "09:30",
    status: "available",
  },
  {
    date: "2026-06-12",
    startTime: "09:30",
    endTime: "10:00",
    status: "available",
  },
];

test("leaves all slots available when there are no reservations", () => {
  assert.deepEqual(applyReservationAvailability(slots, []), slots);
});

test("marks only the exact matching slot as unavailable", () => {
  const result = applyReservationAvailability(slots, [slots[0]]);

  assert.deepEqual(result, [
    {
      date: "2026-06-12",
      startTime: "09:00",
      endTime: "09:30",
      status: "unavailable",
    },
    {
      date: "2026-06-12",
      startTime: "09:30",
      endTime: "10:00",
      status: "available",
    },
  ]);
});

test("does not change slots for a non-matching reservation", () => {
  const existingReservation: Slot = {
    date: "2026-06-13",
    startTime: "09:00",
    endTime: "09:30",
    status: "available",
  };

  assert.deepEqual(
    applyReservationAvailability(slots, [existingReservation]),
    slots,
  );
});

test("preserves slot ordering", () => {
  const result = applyReservationAvailability(slots, [slots[1]]);

  assert.deepEqual(
    result.map(({ startTime }) => startTime),
    ["09:00", "09:30"],
  );
});

test("does not mutate input arrays", () => {
  const inputSlots: Slot[] = slots.map((slot) => ({ ...slot }));
  const inputReservations: Slot[] = [slots[0]].map((slot) => ({ ...slot }));
  const originalSlots = inputSlots.map((slot) => ({ ...slot }));
  const originalReservations = inputReservations.map((slot) => ({ ...slot }));

  applyReservationAvailability(inputSlots, inputReservations);

  assert.deepEqual(inputSlots, originalSlots);
  assert.deepEqual(inputReservations, originalReservations);
});
