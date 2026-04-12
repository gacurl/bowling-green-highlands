import test from "node:test";
import assert from "node:assert/strict";
import { getAvailableSlots } from "./availability.ts";
import type { Slot } from "./slots";

test("returns all generated slots as available when there are no reservations", () => {
  assert.deepEqual(getAvailableSlots("2026-06-12", "09:00", "10:00", []), [
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
  ]);
});

test("returns an empty array for invalid slot-generation input", () => {
  assert.deepEqual(getAvailableSlots("2026-06-12", "bad", "10:00", []), []);
});

test("marks only one exact reserved slot as unavailable", () => {
  const existingReservations: Slot[] = [
    {
      date: "2026-06-12",
      startTime: "09:30",
      endTime: "10:00",
      status: "available",
    },
  ];

  assert.deepEqual(
    getAvailableSlots("2026-06-12", "09:00", "10:30", existingReservations),
    [
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
        status: "unavailable",
      },
      {
        date: "2026-06-12",
        startTime: "10:00",
        endTime: "10:30",
        status: "available",
      },
    ],
  );
});

test("does not change availability for a non-matching reservation", () => {
  const existingReservations: Slot[] = [
    {
      date: "2026-06-13",
      startTime: "09:00",
      endTime: "09:30",
      status: "available",
    },
  ];

  assert.deepEqual(
    getAvailableSlots("2026-06-12", "09:00", "10:00", existingReservations),
    [
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
    ],
  );
});

test("preserves generated slot ordering", () => {
  const result = getAvailableSlots("2026-06-12", "09:00", "10:30", [
    {
      date: "2026-06-12",
      startTime: "10:00",
      endTime: "10:30",
      status: "available",
    },
  ]);

  assert.deepEqual(
    result.map(({ startTime }) => startTime),
    ["09:00", "09:30", "10:00"],
  );
});

test("does not mutate reservation inputs", () => {
  const existingReservations: Slot[] = [
    {
      date: "2026-06-12",
      startTime: "09:30",
      endTime: "10:00",
      status: "available",
    },
  ];
  const originalReservations = existingReservations.map((slot) => ({ ...slot }));

  getAvailableSlots("2026-06-12", "09:00", "10:30", existingReservations);

  assert.deepEqual(existingReservations, originalReservations);
});
